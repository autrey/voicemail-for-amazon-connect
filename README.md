# Voicemail for Amazon Connect
This solutions deploys the resources necessary to configure a voicemail system to use with Amazon Connect. See [Solution Architecture](https://aws.amazon.com/solutions/implementations/voicemail-for-amazon-connect/).

## Version Update Note
* Please note that we have pushed an update to the GitHub repo, however, we have not updated the implementation guide yet. If you want to deploy the most recent version, please refer to CHANGELOG.MD. Updates to the implementation guide will be released in the coming weeks. 

## Running unit tests for customization
* Clone the repository, then make the desired code changes
* Next, run unit tests to make sure added customization passes the tests
```
cd ./source/aws-connect-vm-serverless
npm run test
```

## Building distributable for customization
* Configure the bucket name of your target Amazon S3 distribution bucket
```
export DIST_OUTPUT_BUCKET=my-bucket-name # bucket where customized code will reside
export SOLUTION_NAME=my-solution-name
export VERSION=my-version # version number for the customized code
```
_Note:_ You would have to create an S3 bucket with the prefix 'my-bucket-name-<aws_region>'; aws_region is where you are testing the customized solution. Also, the assets in bucket should be publicly accessible.

* Now build the distributable:
```
chmod +x ./build-s3-dist.sh \n
./build-s3-dist.sh $DIST_OUTPUT_BUCKET $SOLUTION_NAME $VERSION \n
```

* Deploy the distributable to an Amazon S3 bucket in your account. _Note:_ you must have the AWS Command Line Interface installed.
```
aws s3 cp ./dist/ s3://my-bucket-name-<aws_region>/$SOLUTION_NAME/$VERSION/ --recursive --acl bucket-owner-full-control --profile aws-cred-profile-name \n
```

* Get the link of the solution template uploaded to your Amazon S3 bucket.
* Deploy the solution to your account by launching a new AWS CloudFormation stack using the link of the solution template in Amazon S3.

*** 

## File Structure

```
|-deployment/
  |-build-s3-dist.sh             [ shell script for packaging distribution assets ]
  |-run-unit-tests.sh            [ shell script for executing unit tests ]
  |-solution.yaml                [ solution CloudFormation deployment template ]
|-source/
  |-example-function-js          [ Example microservice function in javascript ]
    |- lib/                      [ Example function libraries ]
  |-example-function-py          [ Example microservice function in python ]

```

Each microservice follows the structure of:

```
|-service-name/
  |-lib/
    |-[service module libraries and unit tests]
  |-index.js [injection point for microservice]
  |-package.json
```

***


Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://www.apache.org/licenses/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.


## Notes

* Removed AudioRecordingsBucketReadPolicy from aws-connect-vm-template

```json
"AudioRecordingsBucketReadPolicy": {
      "Type": "AWS::S3::BucketPolicy",
      "Properties": {
        "Bucket": {
          "Ref": "AudioRecordingsBucket"
        },
        "PolicyDocument": {
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "AWS": {
                  "Ref": "AWS::AccountId"
                }
              },
              "Action": "s3:GetObject",
              "Resource": {
                "Fn::Sub": "arn:aws:s3:::${AudioRecordingsBucket}/*"
              }
            },
            {
              "Effect": "Deny",
              "Principal": "*",
              "Action": "s3:GetObject",
              "Resource": {
                "Fn::Sub": "arn:aws:s3:::${AudioRecordingsBucket}/*"
              },
              "Condition": {
                "Bool": {
                  "aws:SecureTransport": "false"
                }
              }
            }
          ]
        }
      }
    }
```

* Removed the following policy from cloudfront.template

```yaml
PortalBucketReadPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref PortalBucket
      PolicyDocument:
        Statement:
          - Action: 's3:GetObject'
            Effect: Allow
            Resource: !Sub 'arn:aws:s3:::${PortalBucket}/*'
            Principal:
              CanonicalUser: !GetAtt CloudFrontOriginAccessIdentity.S3CanonicalUserId
          - Action: "s3:GetObject"
            Effect: Deny
            Resource: !Sub 'arn:aws:s3:::${PortalBucket}/*'
            Principal: "*"
            Condition:
              Bool:
                'aws:SecureTransport': 'false'
```
* Changed the policy for 

arn:aws:connect:us-east-1:686518649249:instance/b75e7c46-36ef-4429-ac90-a9e5968a3c52

* The policy for the BuildContactFlowLambda is

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:us-east-2:686518649249:log-group:/aws/lambda/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "connect:ListQueues"
            ],
            "Resource": "arn:aws:connect:us-east-1:686518649249:instance/b75e7c46-36ef-4429-ac90-a9e5968a3c52",
            "Effect": "Allow"
        }
    ]
}
```
* Just added a setting to allow the DynamoDB Service used by the Users Repo to accept/use an optional environment var of DDB_REGION in case we don't want to use the default in the Lambda function that's using the service.

* Changed the timeout of the KVS Processing Java Lambda to 5 mins.

* Added SECRET_ARN to the Transcription Events Lambda, added the permissions to access the secret to the Lambda's execution role