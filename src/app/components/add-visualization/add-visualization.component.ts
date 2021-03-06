import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material';

import { ActiveGridService } from '../../services/active-grid.service';
import { ThemesService } from '../../services/themes.service';
import { neonVisualizations } from '../../neon-namespaces';

@Component({
  selector: 'app-add-visualization-dialog',
  templateUrl: './add-visualization.component.html',
  styleUrls: ['./add-visualization.component.scss']
})
export class AddVisualizationComponent implements OnInit {

    public visualizations: any[];
    public selectedIndex: number = -1;

    constructor(private activeGridService: ActiveGridService, public themesService: ThemesService,
        public dialogRef: MatDialogRef<AddVisualizationComponent>) {
        this.themesService = themesService;
    }

    ngOnInit() {
        this.visualizations = neonVisualizations;
    }

    public onItemSelected(index) {
        if (this.selectedIndex !== -1) {
            this.visualizations[this.selectedIndex].selected = false;
        }
        this.visualizations[index].selected = true;
        this.selectedIndex = index;

        this.activeGridService.addItemInFirstFit(this.visualizations[index]);
    }
}
