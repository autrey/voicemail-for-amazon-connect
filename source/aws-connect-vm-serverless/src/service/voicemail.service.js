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

import {ContactVoicemail} from "../domain/voicemail.domain";

class ContactVoicemailService {

    constructor(voicemailRepo, agentService, notificationService, globalSettingsService) {
        this.voicemailRepo = voicemailRepo;
        this.agentService = agentService;
        this.notificationService = notificationService;
        this.globalSettingsService = globalSettingsService;
    }

    updateVoicemailTranscriptStatus(jobName, status) {
        let jobNameSplit = jobName.split("_");
        let contactId = jobNameSplit[0];
        let timestamp = parseInt(jobNameSplit[1]);
        return this.voicemailRepo.updateTranscriptionStatus(contactId, timestamp, status);
    }

    processVoicemailRecords(eventName, newRecord, oldRecord) {
        console.log("Processing Voicemail Recording");
        console.log('newRecord:')
        console.log(newRecord)
        console.log('oldRecord:')
        console.log(oldRecord)
        console.log('eventName:')
        console.log(eventName)
        
        let newVoicemail = new ContactVoicemail(newRecord);
        console.log('new voicemail obj:')
        console.log(newVoicemail)
        
        let oldVoicemail = new ContactVoicemail(oldRecord);
        console.log('nold voicemail obj:')
        console.log(oldVoicemail)

        let transcribeCompleted = (oldVoicemail.transcribeStatus === "IN_PROGRESS" && newVoicemail.transcribeStatus === "COMPLETED");
        if (transcribeCompleted) {
            console.log('transcription completed');
            return this._deliver(newVoicemail);
        } else if (newVoicemail.transcribeStatus === null || newVoicemail.transcribeStatus === undefined) {
            console.log('attempting to deliver voicemail that has a null or undefined transcription status');
            return this._deliver(newVoicemail);
        } else {
            console.log('unhandled resolution');
            console.log(`transcription status is: ${newVoicemail.transcribeStatus}`);
            return Promise.resolve({message: "Unhandled Resolution"});
        }
    }

    _deliver(voicemail) {
        return Promise.all([this.globalSettingsService.getSettings(), this.agentService.getConnectAgentByUserId(voicemail.agentId)])
            .then(result => {
                let globalSettings = result[0];
                let connectAgent = result[1];
                console.log('delivering...');
                console.log(connectAgent);
                console.log(voicemail);
                console.log(globalSettings);
                return this.notificationService.deliver(globalSettings, voicemail, connectAgent);
            });
    }

}

export {ContactVoicemailService};