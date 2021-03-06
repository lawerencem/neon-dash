/* tslint:disable:no-unused-variable */
/*
 * Copyright 2016 Next Century Corporation
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { TestBed, inject } from '@angular/core/testing';
import { ParameterService } from './parameter.service';
import { ErrorNotificationService } from './error-notification.service';
import { DatasetService } from './dataset.service';
import { ConnectionService } from './connection.service';
import { FilterService } from './filter.service';
import { NeonGTDConfig } from '../neon-gtd-config';

describe('Service: Parameter', () => {

    let testConfig: NeonGTDConfig = new NeonGTDConfig();

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ParameterService,
                ErrorNotificationService,
                DatasetService,
                ConnectionService,
                FilterService,
                { provide: 'config', useValue: testConfig }
            ]
        });
    });

    it('should ...', inject([ParameterService], (service: ParameterService) => {
        expect(service).toBeTruthy();
    }));
});
