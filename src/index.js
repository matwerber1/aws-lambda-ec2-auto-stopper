var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();

const config = {
  debug:                  true,                                           // if true, print additional info to logs
  terminateSpotInstances: false,                                           // spot instances can't be stopped; set to true to terminate spots that aren't properly tagged; false = let spot keep
  autostopTagKey:         "autostop",                                     // the tag key that controls whether or not to stop the EC2 instances
  ec2StateCodes:          ["0", "16", "64", "80"],                        // which EC2 states should we tag? regardless, we will only start/stop running instances
  dryRun:                 false                                            // AWS API commands will not actually make changes to infrastructure

  /*  valid values of State.Code and State.Name for EC2:
  0 : pending
  16 : running
  32 : shutting-down
  48 : terminated
  64 : stopping
  80 : stopped
  */  
};

//##############################################################################
exports.handler = async (event, context) => {

  try {

    // get list of EC2 instances with specified state codes
    let instances = await getEc2Instances();

    for (const i of instances) {
    // We loop through all instances that match a state in config.ec2StateCodes.
    // For any instance found that does not have the autostop tag, we add it with a
    // default value of true. For any instance that is running and where autostop
    // value is true, we will stop the instance if it is on-demand or terminate the
    // the instance if it autostop value is true *and* config.terminateSpotInstances = true. 

      let autostopTagValue = undefined; 
      
      if (config.autostopTagKey in i.TagsAsJSON) {
        autostopTagValue = i.TagsAsJSON[config.autostopTagKey];
      }
      
      if (autostopTagValue === undefined) {
      // if autostop tag is mising, add it with default value of true to any instance matching our config.ec2StateCodes

        console.log(`Instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) is missing tag ${config.autostopTagKey}; adding tag with default value true to instance...`);
        await addTagsToResources( [i.InstanceId], [{Key: config.autostopTagKey, Value: 'true' }] );
        autostopTagValue = "true";
        
      } 
      
      if (autostopTagValue === "true" && i.State.Name === "running") {
      /* if an instance is tagged to autostop and it is currently running, we
         will truly stop the instance if it is on-demand; if it is a spot instance, 
         we can only terminate the instance. Just to be safe,
      */
        
        let params =  { 
            InstanceIds: [i.InstanceId], 
            DryRun: config.dryRun 
          };
        
        switch (i.LaunchType) {
          
          case "on-demand":
            console.log(`Stopping on-demand instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) because tag ${config.autostopTagKey}='true'.`);
            await ec2.stopInstances(params).promise();
            break;
        
          case "spot":
            
            if (config.terminateSpotInstances === true) {
              console.log(`Stopping on-demand instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) because tag ${config.autostopTagKey}='true'.`);
              await ec2.terminateInstances(params).promise();
            } else {
              console.log(`Spot instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) is tagged to stop (${config.autostopTagKey}='true') but Lambda is configured to not terminate spot instances.`);
            }
            break;

          default:
            throw (`Instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) is tagged to stop (${config.autostopTagKey}='true') but unable to stop/terminate an instance launch type of ${i.LaunchType}.`);
            
        }
        
      } else if (autostopTagValue === "false") {
        console.log(`Instance ${i.InstanceId} (Name = ${i.TagsAsJSON.Name}) tagged to keep running. No action taken.`);  
      }
      
    }
  
  }
  catch (err) {
    console.log('>>>>>>ERROR>>>>>>>\n' + err);
  }
  
};

//##############################################################################
function debugMessage(message) {
  // message = string
  if (config.debug) {
    console.log(message);
  }
}

//##############################################################################
async function getEc2Instances() {
  
  // https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-instances.html
  
  let instances = [];

  var params = {
      Filters: [
        { Name: "instance-state-code", Values: config.ec2StateCodes}
      ]
    };
  
  do {
    
    debugMessage(`Calling ec2.describeInstances(${JSON.stringify(params)})`);
    let response   = await ec2.describeInstances(params).promise();

    for (const r of response.Reservations) {

      for (const i of r.Instances) {
      
        // here, we enrich the describeInstances API response with additional values to make it easier to work with later
        i.TagsAsJSON = getInstanceTagsAsJSON(i.Tags);
        i.LaunchType = getLaunchTypeFromInstanceLifecycle(i.InstanceLifecycle);

        instances.push(i);

      }

    }

    params.NextToken = response.NextToken || undefined;
    
  } while (params.NextToken !== undefined);
  

  console.log(`Total instances with state code in ${JSON.stringify(config.ec2StateCodes,null,0)}: ${instances.length}`);
  
  return instances;
  
}

//##############################################################################
function getInstanceTagsAsJSON(tags) {
  
  /* tags = array of "tags" from an "Instance" from a "Reservation" returned by ec2.describeInstances()
     The purpose is to convert the array to an easier-to-use JSON object. 
  
    For example, the tags we receive might look like this: 
    tags = [
      { Key:   "Name",
        Value: "webserver"
      },
      { Key:   "CostCenter",
        Value: "40394"
      },
      { Key:   "Environment",
        Value: "production"
      }
    ]
  
    Our function returns the following; see, isn't this easier to work with? 
    response = {
      Name:        "webserver",
      CostCenter:  "40394",
      Environment: "production"
    }
  
  */
  
  let response = {};
  
  tags.forEach(function(t) {
    response[t.Key]     = t.Value;
  });
  
  return response;
}

//##############################################################################
async function addTagsToResources(resources, tags) {
  
  // resources = array of resource IDs to tag in the format ["i-234234dfsd", "i-sdfsdf3434"]
  // tags = array of JSON objects in the format [{Key: "someKey", Value: "someValue" }, ... ]
  
  let params = { 
      Resources: resources, 
      Tags: tags
  };

  await ec2.createTags(params).promise();

  return;
}


//##############################################################################
function getLaunchTypeFromInstanceLifecycle(lifecycle) {
  
  // if the InstanceLifecycle key is present in an instance object returned by ec2.describeInstances, 
  // then the instanceType is either spot or scheduled. If the key is not present / undefined, then it is on-demand. 
  
  let response = undefined;
  
  switch(lifecycle) {
    case "spot":
      response = "spot";
      break;
    case "scheduled":
      response = "scheduled";
      break;
    case undefined:           // as of writing of this function, if the InstanceLifecycle key is not present, it is an on-demand instance.
      response = "on-demand";
      break;
    default:                  // just in case a new value appears in the future, let's raise an error to call out fact that we don't know how to handle it. 
      throw(`Unknown EC2 InstanceLifecycle value of '${lifecycle}'.`);
  }

  return response;  
}