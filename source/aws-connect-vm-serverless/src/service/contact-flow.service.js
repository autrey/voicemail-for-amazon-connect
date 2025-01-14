/******************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved. 
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not
 *  use this file except in compliance with the License. A copy of the License
 *  is located at                                                            
 *                                                                              
 *      http://www.apache.org/licenses/                                        
 *  or in the 'license' file accompanying this file. This file is distributed on
 *  an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or
 *  implied. See the License for the specific language governing permissions and
 *  limitations under the License.                                              
******************************************************************************/

import AWS from "../../node_modules/aws-sdk";
import {GenericError} from "../errors/standard.errors";

const VoicemailDurationType = {
    SECOND: "SECOND",
    MINUTE: "MINUTE"
};

class ContactFlowService {

    constructor() {

        let _getPosition = function(string, subString, index) {
            return string.split(subString, index).join(subString).length;
          };


        const arn = process.env.AMAZON_CONNECT_INSTANCE_ARN;
        const connectRegion = arn.substr(_getPosition(arn, ":", 3)+1, _getPosition(arn, ":", 4) - _getPosition(arn, ":", 3)-1)
        this.connect = new AWS.Connect({
            region: connectRegion
        });
        this.connect.endpoint = `https://connect.${connectRegion}.amazonaws.com`;
        console.info(`Connect service endpoint set to: ${this.connect.endpoint}`);
        
        this.awsConnectInstanceId = process.env.AMAZON_CONNECT_INSTANCE_ARN.split('/')[1];
        this.getContactInfoLambdaArn = process.env.GET_AGENT_BY_EXTENSION_LAMBDA_ARN;
        this.loggingEnabled = true;
        this.extensionPromptMessage = "Please enter your party's extension number to continue.";
        this.agentNotFoundErrorMessage = "We cannot find an agent with the extension number you entered.";
        this.loopCountMetTransferMessage = "Please wait while we transfer you over to our next available representative.";
        this.agentQueueSetError = "We're sorry, we were unable to connect you to your agent at the moment.";
    }

    async build({welcomeMessage, defaultErrorMessage, maxVoicemailDuration, durationType, fallbackQueueName, errorLoopCount}) {
        let flowArr = [];

        // Duration
        let logging = this.loggingEnabled ? "Enable" : "Disable";

        // Get queue matching fallback queue name
        let connectQueues = await this.connect.listQueues({
            InstanceId: this.awsConnectInstanceId
        }).promise();

        let fallbackQueue = (connectQueues.QueueSummaryList || []).filter(queue => queue.Name === fallbackQueueName)[0];
        if (!fallbackQueue) {
            throw new GenericError(
                "ConnectQueueNotFound",
                `The queue with the name "${fallbackQueueName}" cannot be found. Please check to see if the queue exists in your Amazon Connect instance`,
                `Fallback queue when building contact flow: ${fallbackQueueName} cannot be found`
            );
        }

        let {leaveVoicemailPrompt, voicemailDuration} = this._getLeaveVoicemailPrompt(maxVoicemailDuration, durationType);

        let flow1 = `{"modules":[{"id":"d30c8053-225e-4f9a-b867-022e7d321f8a","type":"Loop","branches":[{"condition":"Looping","transition":"13a045a7-2116-4676-97b1-fd95db37e0fa"},{"condition":"Complete","transition":"ae8419f5-d469-4a07-90f1-e1a95fb3c1f9"}],"parameters":[{"name":"LoopCount","value":"${errorLoopCount}"}],"metadata":{"position":{"x":1648,"y":938},"useDynamic":false}},{"id":"e9961d17-9a6f-4dfb-93c6-84fe59f13b7a","type":"CheckAttribute","branches":[{"condition":"Evaluate","conditionType":"Equals","conditionValue":"default","transition":"2b987e46-00c6-4e0a-8dae-1fe55f495f70"},{"condition":"NoMatch","transition":"4217a94c-00e6-4a35-a90e-b14442694f15"}],"parameters":[{"name":"Attribute","value":"agentName"},{"name":"Namespace","value":"User Defined"}],"metadata":{"position":{"x":1572,"y":267},"conditionMetadata":[{"id":"f6eee0a8-681e-4cb2-ac9e-51d646ca69a3","operator":{"name":"Equals","value":"Equals","shortDisplay":"="},"value":"default"}]}},{"id":"126c588a-782f-4624-8c6a-3db9d61125d7","type":"PlayPrompt","branches":[{"condition":"Success","transition":"13a045a7-2116-4676-97b1-fd95db37e0fa"}],"parameters":[{"name":"Text","value":"${welcomeMessage}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":430,"y":589},"useDynamic":false}},{"id":"b5bc6e4a-a590-4481-bb92-f485d14f6e28","type":"SetLoggingBehavior","branches":[{"condition":"Success","transition":"126c588a-782f-4624-8c6a-3db9d61125d7"}],"parameters":[{"name":"LoggingBehavior","value":"${logging}"}],"metadata":{"position":{"x":214,"y":472}}},{"id":"0c9d0009-c70e-403f-aa24-536f80791ae3","type":"PlayPrompt","branches":[{"condition":"Success","transition":"d30c8053-225e-4f9a-b867-022e7d321f8a"}],"parameters":[{"name":"Text","value":"${this.agentNotFoundErrorMessage}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":1635,"y":574},"useDynamic":false}},{"id":"4363b6a1-b0e2-442d-a468-afbfcd5d3dd4","type":"InvokeExternalResource","branches":[{"condition":"Success","transition":"9878c05d-1152-4a04-b8a5-a44221497364"},{"condition":"Error","transition":"0c9d0009-c70e-403f-aa24-536f80791ae3"}],"parameters":[{"name":"FunctionArn","value":"${this.getContactInfoLambdaArn}","namespace":null},{"name":"TimeLimit","value":"8"},{"name":"Parameter","key":"extensionNumber","value":"extensionNumber","namespace":"User Defined"}],"metadata":{"position":{"x":1111,"y":494},"dynamicMetadata":{"extensionNumber":true},"useDynamic":false},"target":"Lambda"},{"id":"2b987e46-00c6-4e0a-8dae-1fe55f495f70","type":"SetQueue","branches":[{"condition":"Success","transition":"453aff7e-a46c-40b0-9151-33d985e99d14"},{"condition":"Error","transition":"453aff7e-a46c-40b0-9151-33d985e99d14"}],"parameters":[{"name":"Queue","value":"${fallbackQueue.Arn}","namespace":null,"resourceName":"${fallbackQueueName}"}],"metadata":{"position":{"x":2447,"y":917},"useDynamic":false,"queue":{"id":"${fallbackQueue.Arn}","text":"${fallbackQueueName}"}}},{"id":"6363795b-2c86-4a0b-94f3-7c00fb81bb72","type":"SetAttributes","branches":[{"condition":"Success","transition":"d03dc4f9-ea5f-40c3-adb7-5a72ebc3b198"},{"condition":"Error","transition":"d03dc4f9-ea5f-40c3-adb7-5a72ebc3b198"}],"parameters":[{"name":"Attribute","value":"true","key":"available","namespace":null}],"metadata":{"position":{"x":2512,"y":78}}},{"id":"4a9e6603-dde2-4395-8d4e-4be57d7f7312","type":"SetContactFlow","branches":[{"condition":"Success","transition":"c605c995-7168-4213-bbf7-430d09f6b106"}],"parameters":[{"name":"ContactFlowId","value":"","resourceName":"VM-Agent"},{"name":"Type","value":"CustomerQueue"}],"metadata":{"position":{"x":2050,"y":182},"contactFlow":{"id":"","text":"VM-Agent"},"customerOrAgent":false}},{"id":"ccacbfd4-bc57-4d64-9cc4-4665c98dcd4a","type":"Disconnect","branches":[],"parameters":[],"metadata":{"position":{"x":3228,"y":413}}},{"id":"13a045a7-2116-4676-97b1-fd95db37e0fa","type":"StoreUserInput","branches":[{"condition":"Success","transition":"361a8c43-f9d3-4a68-8832-51c64f407951"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[{"name":"Text","value":"${this.extensionPromptMessage}"},{"name":"TextToSpeechType","value":"text"},{"name":"CustomerInputType","value":"Custom"},{"name":"Timeout","value":"${voicemailDuration}"},{"name":"MaxDigits","value":5},{"name":"EncryptEntry","value":"false"}],"metadata":{"position":{"x":656,"y":685},"useDynamic":false,"useDynamicForEncryptionKeys":true,"useDynamicForTerminatorDigits":false,"countryCodePrefix":"+1"}},{"id":"453aff7e-a46c-40b0-9151-33d985e99d14","type":"Transfer","branches":[{"condition":"AtCapacity","transition":"ccacbfd4-bc57-4d64-9cc4-4665c98dcd4a"},{"condition":"Error","transition":"730965ba-570c-4856-a27d-25955922bb6d"}],"parameters":[],"metadata":{"position":{"x":2717,"y":917},"useDynamic":false,"queue":null},"target":"Queue"},{"id":"361a8c43-f9d3-4a68-8832-51c64f407951","type":"SetAttributes","branches":[{"condition":"Success","transition":"4363b6a1-b0e2-442d-a468-afbfcd5d3dd4"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[{"name":"Attribute","value":"Stored customer input","key":"extensionNumber","namespace":"System"}],"metadata":{"position":{"x":882,"y":594}}},{"id":"730965ba-570c-4856-a27d-25955922bb6d","type":"PlayPrompt","branches":[{"condition":"Success","transition":"ccacbfd4-bc57-4d64-9cc4-4665c98dcd4a"}],"parameters":[{"name":"Text","value":"${defaultErrorMessage}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":2968,"y":493},"useDynamic":false}},{"id":"ae8419f5-d469-4a07-90f1-e1a95fb3c1f9","type":"PlayPrompt","branches":[{"condition":"Success","transition":"2b987e46-00c6-4e0a-8dae-1fe55f495f70"}],"parameters":[{"name":"Text","value":"${this.loopCountMetTransferMessage}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":2100,"y":918},"useDynamic":false}},{"id":"9878c05d-1152-4a04-b8a5-a44221497364","type":"SetAttributes","branches":[{"condition":"Success","transition":"e9961d17-9a6f-4dfb-93c6-84fe59f13b7a"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[{"name":"Attribute","value":"agentId","key":"agentId","namespace":"External"},{"name":"Attribute","value":"agentName","key":"agentName","namespace":"External"},{"name":"Attribute","value":"transferMessage","key":"transferMessage","namespace":"External"},{"name":"Attribute","value":"transcribeVoicemail","key":"transcribeVoicemail","namespace":"External"},{"name":"Attribute","value":"saveCallRecording","key":"saveCallRecording","namespace":"External"},{"name":"Attribute","value":"encryptVoicemail","key":"encryptVoicemail","namespace":"External"}],"metadata":{"position":{"x":1340,"y":387}}},{"id":"d03dc4f9-ea5f-40c3-adb7-5a72ebc3b198","type":"Transfer","branches":[{"condition":"AtCapacity","transition":"ccacbfd4-bc57-4d64-9cc4-4665c98dcd4a"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[],"metadata":{"position":{"x":2743,"y":106},"useDynamic":false,"queue":null},"target":"Queue"},{"id":"c605c995-7168-4213-bbf7-430d09f6b106","type":"CheckStaffing","branches":[{"condition":"True","transition":"6363795b-2c86-4a0b-94f3-7c00fb81bb72"},{"condition":"False","transition":"d03dc4f9-ea5f-40c3-adb7-5a72ebc3b198"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[{"name":"Status","value":"Available"}],"metadata":{"position":{"x":2278,"y":128},"useDynamic":false,"queue":null}},{"id":"4217a94c-00e6-4a35-a90e-b14442694f15","type":"SetQueue","branches":[{"condition":"Success","transition":"4a9e6603-dde2-4395-8d4e-4be57d7f7312"},{"condition":"Error","transition":"52f45340-9883-4baf-a5ff-280b8945b54e"}],"parameters":[{"name":"Agent","value":"agentId","namespace":"User Defined","resourceName":null}],"metadata":{"position":{"x":1807,"y":160},"useDynamic":true,"queue":"agentId"}},{"id":"52f45340-9883-4baf-a5ff-280b8945b54e","type":"PlayPrompt","branches":[{"condition":"Success","transition":"ae8419f5-d469-4a07-90f1-e1a95fb3c1f9"}],"parameters":[{"name":"Text","value":"${this.agentQueueSetError}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":2523,"y":495},"useDynamic":false}}],"version":"1","type":"contactFlow","start":"b5bc6e4a-a590-4481-bb92-f485d14f6e28","metadata":{"entryPointPosition":{"x":82,"y":398},"snapToGrid":false,"name":"VM-Greeting","description":"Initial caller contact to get agent extension","type":"contactFlow","status":"published","hash":"a7ddeb573391c39770daf0378cfc95fc327d33b8867476ed9bb06dbe1ffd6347"}}`;

        let flow2 = `{"modules":[{"id":"43786425-989f-40cf-bc6a-abe43297f2cd","type":"SetLoggingBehavior","branches":[{"condition":"Success","transition":"f0d6b7b9-3889-4735-b8e4-4a2a9f11dd1e"}],"parameters":[{"name":"LoggingBehavior","value":"${logging}"}],"metadata":{"position":{"x":201,"y":167}}},{"id":"f0d6b7b9-3889-4735-b8e4-4a2a9f11dd1e","type":"CheckAttribute","branches":[{"condition":"Evaluate","conditionType":"Equals","conditionValue":"true","transition":"062355a9-7ef1-4a58-822f-2e96caa1c7bb"},{"condition":"NoMatch","transition":"75df61cb-e078-4a7b-ba95-8bdfb073a5f6"}],"parameters":[{"name":"Attribute","value":"available"},{"name":"Namespace","value":"User Defined"}],"metadata":{"position":{"x":448,"y":215},"conditionMetadata":[{"id":"d0067b9d-b4cd-4ee9-bc86-6bab0de0374f","operator":{"name":"Equals","value":"Equals","shortDisplay":"="},"value":"true"}]}},{"id":"75df61cb-e078-4a7b-ba95-8bdfb073a5f6","type":"LoopPrompts","branches":[{"condition":"Timeout","transition":"3cd76775-9c08-4683-9d20-9bea0ff75033"},{"condition":"Error","transition":"3cd76775-9c08-4683-9d20-9bea0ff75033"}],"parameters":[{"name":"Text","value":",","key":"text"},{"name":"InterruptSeconds","value":1}],"metadata":{"position":{"x":731,"y":395},"audio":[{"tts":",","useTts":true,"ttsType":"text","type":"Text"}],"timeoutUnit":{"display":"Seconds","value":"sec"}}},{"id":"3cd76775-9c08-4683-9d20-9bea0ff75033","type":"PlayPrompt","branches":[{"condition":"Success","transition":"5bc7743e-0a8a-478e-b1e8-444dc822eaf5"}],"parameters":[{"name":"Text","value":"<speak><prosody rate=\\"slow\\"> $.Attributes.agentName </prosody> </speak>","namespace":null},{"name":"TextToSpeechType","value":"ssml"}],"metadata":{"position":{"x":971,"y":394},"useDynamic":false}},{"id":"5bc7743e-0a8a-478e-b1e8-444dc822eaf5","type":"PlayPrompt","branches":[{"condition":"Success","transition":"3895ed1e-4939-4731-832a-7f8f16c4fcad"}],"parameters":[{"name":"Text","value":"Is not available.","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":1226,"y":394},"useDynamic":false}},{"id":"062355a9-7ef1-4a58-822f-2e96caa1c7bb","type":"LoopPrompts","branches":[{"condition":"Timeout","transition":"3895ed1e-4939-4731-832a-7f8f16c4fcad"},{"condition":"Error","transition":"3895ed1e-4939-4731-832a-7f8f16c4fcad"}],"parameters":[{"name":"Text","value":"<speak>Thank you for calling. Please wait while we connect you to <prosody rate=\\"slow\\"> $.Attributes.agentName </prosody> </speak>","key":"ssml"},{"name":"Text","value":"<speak><break time=\\"3s\\"/></speak>","key":"ssml"},{"name":"InterruptSeconds","value":20}],"metadata":{"position":{"x":920,"y":153},"audio":[{"tts":"<speak>Thank you for calling. Please wait while we connect you to <prosody rate=\\"slow\\"> $.Attributes.agentName </prosody> </speak>","useTts":true,"ttsType":"ssml","type":"Text"},{"tts":"<speak><break time=\\"3s\\"/></speak>","useTts":true,"ttsType":"ssml","type":"Text"}],"timeoutUnit":{"display":"Seconds","value":"sec"}}},{"id":"3895ed1e-4939-4731-832a-7f8f16c4fcad","type":"PlayPrompt","branches":[{"condition":"Success","transition":"15612b29-5f95-4e1a-940b-5a4005edad5d"}],"parameters":[{"name":"Text","value":"${leaveVoicemailPrompt}","namespace":null},{"name":"TextToSpeechType","value":"text"}],"metadata":{"position":{"x":1465,"y":99},"useDynamic":false}},{"id":"15612b29-5f95-4e1a-940b-5a4005edad5d","type":"PlayPrompt","branches":[{"condition":"Success","transition":"3d5fbe06-a997-4f91-ae04-bfda790c01a4"}],"parameters":[{"name":"AudioPrompt","value":"","namespace":null,"resourceName":"Beep.wav"}],"metadata":{"position":{"x":1704,"y":97},"useDynamic":false,"promptName":"Beep.wav"}},{"id":"513299ca-5e44-4141-a9ba-d9508fcea48f","type":"SetAttributes","branches":[{"condition":"Success","transition":"e74b1dbe-ff92-46c7-947c-a78cb031763e"},{"condition":"Error","transition":"e74b1dbe-ff92-46c7-947c-a78cb031763e"}],"parameters":[{"name":"Attribute","value":"failure","key":"startStreamingAudioStatus","namespace":null}],"metadata":{"position":{"x":2183,"y":283}}},{"id":"3d5fbe06-a997-4f91-ae04-bfda790c01a4","type":"StartMediaStreaming","branches":[{"condition":"Success","transition":"e74b1dbe-ff92-46c7-947c-a78cb031763e"},{"condition":"Error","transition":"513299ca-5e44-4141-a9ba-d9508fcea48f"}],"parameters":[{"name":"Track","value":"FromCustomer"},{"name":"MediaStreamTypes","value":"Audio"}],"metadata":{"position":{"x":1946,"y":97},"fromCustomer":true,"toCustomer":false}},{"id":"e74b1dbe-ff92-46c7-947c-a78cb031763e","type":"GetUserInput","branches":[{"condition":"Timeout","transition":"95a26764-3940-450c-9918-7a2b666c0dda"},{"condition":"NoMatch","transition":"95a26764-3940-450c-9918-7a2b666c0dda"},{"condition":"Error","transition":"95a26764-3940-450c-9918-7a2b666c0dda"}],"parameters":[{"name":"Text","value":"<speak></speak>","namespace":null},{"name":"TextToSpeechType","value":"ssml"},{"name":"Timeout","value":"${voicemailDuration}"},{"name":"MaxDigits","value":"1"}],"metadata":{"position":{"x":2427,"y":96},"conditionMetadata":[],"useDynamic":false},"target":"Digits"},{"id":"95a26764-3940-450c-9918-7a2b666c0dda","type":"StopMediaStreaming","branches":[{"condition":"Success","transition":"1ad1a458-0933-4f32-bf44-56fbc7d130d5"},{"condition":"Error","transition":"1ad1a458-0933-4f32-bf44-56fbc7d130d5"}],"parameters":[{"name":"Track","value":"FromCustomer"},{"name":"Track","value":"ToCustomer"},{"name":"MediaStreamTypes","value":"Audio"}],"metadata":{"position":{"x":2690,"y":97}}},{"id":"1ad1a458-0933-4f32-bf44-56fbc7d130d5","type":"Disconnect","branches":[],"parameters":[],"metadata":{"position":{"x":2969,"y":149}}}],"version":"1","type":"customerQueue","start":"43786425-989f-40cf-bc6a-abe43297f2cd","metadata":{"entryPointPosition":{"x":45,"y":129},"snapToGrid":false,"name":"VM-Agent","description":"Customer queue flow to leave a message for agent","type":"customerQueue","status":"published","hash":"96f6d0e8b369620448cbc232f4b117e38588e7661895ffba2b2ee60c74f47ed2"}}`;

        flowArr.push(JSON.parse(flow1), JSON.parse(flow2));

        return flowArr;
    }

    _getLeaveVoicemailPrompt(maxVoicemailDuration, durationType) {
        let durationLabel = "";
        let voicemailDuration = maxVoicemailDuration;
        switch (durationType) {
            case VoicemailDurationType.SECOND:
                durationLabel = (maxVoicemailDuration === 1) ? "second" : "seconds";
                break;
            case VoicemailDurationType.MINUTE:
                voicemailDuration = maxVoicemailDuration * 60;
                durationLabel = (maxVoicemailDuration === 1) ? "minute" : "minutes";
                break;
            default:
                break;
        }
        return {
            voicemailDuration,
            leaveVoicemailPrompt: `Please leave a message after the beep. You have ${maxVoicemailDuration} ${durationLabel}`
        };
    }

}

export {ContactFlowService, VoicemailDurationType};
