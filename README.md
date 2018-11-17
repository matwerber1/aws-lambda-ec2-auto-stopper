# aws-lambda-ec2-auto-stopper

# Overview

This [AWS SAM](https://github.com/awslabs/serverless-application-model) project deploys a serverless function comprised of a Lambda that 
is triggered once every 24 hours by a CloudWatch Event to top any running EC2 instance if the instance does *not* have a tag key/value of 
{ autostop: false }. In other words, if the autostop tag is not present *or* the autostop tag is present with any value other than false,
this function will stop that instance. This function is triggered once every 24 hours by a CloudWatch Event. The included CloudFormation 
template also creates an IAM role for the Lambda that allows the function to perform required functions. 

If an EC2 instance does not already have an autostop tag, this function will add a key/value tag of { autostop: true }, meaning that the
instance will be stopped the next time the function runs. 

# Deployment

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

Optionally, you can manually invoke the Lambda and include a JSON payload of {overridePolicies: true} to change the retention period for all log groups, regardless of what their current policies are. 

Here is an example of the output from the Lambda function: 

  ```
  ```