# aws-lambda-ec2-auto-stopper

# Deprecated

This project is superceded by the project below:
https://github.com/matwerber1/aws-lambda-resource-stopper

The new project is my first dive into Typescript, supports multiple resource types, and in general (I hope) is better written.

## Overview

This [AWS SAM](https://github.com/awslabs/serverless-application-model) project deploys a serverless function comprised of a Lambda that 
is triggered once every 24 hours by a CloudWatch Event to stop any running EC2 instance if the instance does *not* have a tag key/value of 
{ autostop: false }. In other words, if the autostop tag is not present *or* the autostop tag is present with any value other than false,
this function will stop that instance.

The function will optionally terminate any spot instances if config.terminateSpotInstances = true within the Lambda's code.

If the autostop tag is not present on an instance, this function will create a tag of { autostop: true } on the instance and then proceed
stopping / terminating it as described above. 

Within the Lambda, you can designate an alternative tag name to "autostop" if desired. 


## Deployment

1. Clone the repository
  ```sh
  git clone https://github.com/matwerber1/aws-lambda-ec2-auto-stopper
  ```

2. Within ./deploy.sh, replace YOUR_S3_BUCKET with an existing S3 bucket to use for uploading packaged template to CloudFormation. 
  
  ```sh
  BUCKET_NAME=_YOUR_S3_BUCKET
  ```

3. OPTIONAL - within ./src/index.js, set config.debug to true to have the Lambda function output raw API responses to the function logs. 

4. OPTIONAL - within ./src/index.js, set config.defaultRetentionDays to your desired retention period. 

5. Run deploy.sh

  ```sh
  ./deploy.sh
  ```
  
# Usage

The function will automatically trigger once every 24 hours via a CloudWatch Event. 
