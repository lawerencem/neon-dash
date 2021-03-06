import {
    Component,
    OnInit,
    ViewEncapsulation,
    ChangeDetectionStrategy,
    ViewChild,
    Input,
    EventEmitter,
    Output
} from '@angular/core';
import {ColorSchemeService, ColorSet} from '../../services/color-scheme.service';

/**
 * Component that will display a legend of colors.
 *
 * Provided a list of field names, the legend gets all keys/colors for that set from the
 * ColorSchemeService, and it draws it.
 */
@Component({
    selector: 'app-legend',
    templateUrl: './legend.component.html',
    styleUrls: ['./legend.component.scss'],
    encapsulation: ViewEncapsulation.Emulated, changeDetection: ChangeDetectionStrategy.Default
})
export class LegendComponent implements OnInit {
    /**
     * List of fields that should be colored as 'active'.
     * If this list is non-empty, all values are checked if they should be marked as active
     * from just this list.
     */
    @Input() activeList: string[];
    /**
     * List of fields that should be colored as 'inactive'
     * If the active list is empty, any values in this list will be marked as inactive
     */
    @Input() disabledList: string[];
    /**
     * List of [columnName, value] pairs that should be marked as inactive.
     * If this list is populated, it will be used over the disabledList
     */
    @Input() disabledSets: [string[]];
    /**
     * Event triggered when an item in the legend has been selected.
     * The event includes the field name, value, and a boolean if the value is currently selected
     */
    @Output() itemSelected = new EventEmitter<{fieldName: string, value: string, currentlyActive: boolean}>();

    @ViewChild('menu') menu: any;

    public menuIcon: string;
    public colorSets: ColorSet[] = [];
    private _FieldNames: string[];

    constructor(private colorSchemeService: ColorSchemeService) {
        //private connectionService: ConnectionService, private datasetService: DatasetService, private filterService: FilterService,
        //private exportService: ExportService, private injector: Injector, private themesService: ThemesService) {
        this.menuIcon = 'keyboard_arrow_down';
    }

    @Input() set fieldNames(names: string[]) {
        this._FieldNames = names;
        this.loadAllColorSets();
    }
    get fieldNames(): string[] {
        return this._FieldNames;
    }

    /**
     * Get all the color sets we need from the ColorSchemeService
     */
    private loadAllColorSets() {
        this.colorSets = [];
        if (!this.fieldNames) {
            return;
        }
        for (let name of this.fieldNames) {
            if (name && name !== '') {
                let colorSet = this.colorSchemeService.getColorSet(name);
                if (colorSet) {
                    this.colorSets.push(colorSet);
                }
            }
        }
    }

    ngOnInit() {
        this.loadAllColorSets();
    }

    getColorFor(colorSet: ColorSet, key: string): string {
        let color = colorSet.getColorForValue(key);
        return this.isDisabled(colorSet.name, key) ? color.getInactiveRgba() : color.toRgb();
    }

    /**
     * Handle a selection of a value in the legend
     * @param $event
     * @param {string} setName
     * @param {string} key
     */
    keySelected($event, setName: string, key: string) {
        this.itemSelected.emit({
            fieldName: setName,
            value: key,
            currentlyActive: !this.isDisabled(setName, key)
        });
        $event.stopPropagation();
    }

    /**
     * Check if the value should be marked as disabled
     * @param {string} key
     * @param {string} setName
     * @return {boolean}
     */
    isDisabled(setName: string, key: string): boolean {
        if (this.disabledSets && this.disabledSets.length > 0) {
            try {
                for (let set of this.disabledSets) {
                    if (set[0] === setName && set[1] === key) {
                        return true;
                    }
                }
            } catch (e) {
                console.error(e);
                // Let errors pass
            }
        }
        // If the enabled list is non-null, check it
        if (this.activeList && this.activeList.length > 0) {
            return this.activeList.indexOf(key) === -1;
        }
        return this.disabledList && this.disabledList.indexOf(key) >= 0;
    }

    getIcon(colorSet: ColorSet, key: string): string {
        if (this.isDisabled(colorSet.name, key)) {
            return 'check_box_outline_blank';
        } else {
            return 'check_box';
        }
    }

    onMenuOpen() {
        this.menuIcon = 'keyboard_arrow_up';
    }

    onMenuClose() {
        this.menuIcon = 'keyboard_arrow_down';
    }
}
