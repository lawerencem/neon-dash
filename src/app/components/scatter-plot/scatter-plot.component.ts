import {
    Component,
    OnInit,
    OnDestroy,
    ViewEncapsulation,
    ChangeDetectionStrategy,
    Injector,
    ViewChild,
    ChangeDetectorRef
} from '@angular/core';
import {ConnectionService} from '../../services/connection.service';
import {DatasetService} from '../../services/dataset.service';
import {FilterService} from '../../services/filter.service';
import {ExportService} from '../../services/export.service';
import {ThemesService} from '../../services/themes.service';
import {Color, ColorSchemeService} from '../../services/color-scheme.service';
import {FieldMetaData } from '../../dataset';
import {neonMappings} from '../../neon-namespaces';
import * as neon from 'neon-framework';
import {BaseNeonComponent} from '../base-neon-component/base-neon.component';
import {ChartModule} from 'angular2-chartjs';
import {VisualizationService} from '../../services/visualization.service';

/**
 * Data used to draw the scatter plot
 */
class ScatterPlotData {
    xLabels: any[] = [];
    yLabels: any[] = [];
    labels: any[] = [];
    // The data to graph
    datasets: ScatterDataSet[] = [];
}

/**
 * One set of bars to draw
 */
class ScatterDataSet {
    fill: boolean = false;
    showLine: boolean = false;
    borderWidth: number = 1;

    // The name of the data set
    label: string;
    // The data
    data: {x: any, y: any}[] = [];

    // The colors of the points
    backgroundColor: string;
    borderColor: string;

    // The color of the data set
    color: Color;

    constructor(color: Color) {
        this.color = color;
        this.setActive();
    }

    /**
     * Set the background color to the default color of this set
     */
    setInactive() {
        for (let i = 0; i < this.data.length; i++) {
            this.backgroundColor = this.color.getInactiveRgba();
            this.borderColor = this.backgroundColor;
        }
    }

    /**
     * Set the background color of the set to the active color
     */
    setActive() {
        this.backgroundColor = this.color.toRgb();
        this.borderColor = this.backgroundColor;
    }
}

@Component({
    selector: 'app-scatter-plot',
    templateUrl: './scatter-plot.component.html',
    styleUrls: ['./scatter-plot.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScatterPlotComponent extends BaseNeonComponent implements OnInit,
    OnDestroy {
    @ViewChild('scatter') chartModule: ChartModule;

    private filters: ScatterPlotFilter[];

    private optionsFromConfig: {
        title: string,
        database: string,
        table: string,
        xField: string,
        yField: string,
        labelField: string,
        colorField: string,
        unsharedFilterField: Object,
        unsharedFilterValue: string,
        limit: number
    };
    public active: {
        xField: FieldMetaData,
        yField: FieldMetaData,
        labelField: FieldMetaData,
        andFilters: boolean,
        limit: number,
        filterable: boolean,
        layers: any[],
        xAxisIsNumeric: boolean,
        yAxisIsNumeric: boolean,
        pointLabels: string[],
    };

    // Alternate color: rgba(57, 181, 74, 0.9)
    private defaultColor: Color = new Color(51, 153, 255);

    private mouseEventValid: boolean;

    public selection: {
        mouseDown: boolean
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        height: number,
        width: number,
        x: number,
        y: number,
        visibleOverlay: boolean,
    };

    public chart: {
        data: ScatterPlotData,
        type: string,
        options: any
    };

    private colorSchemeService: ColorSchemeService;

    public colorByFields: string[] = [];
    public disabledList: string[] = [];

    private disabledDatasets: Map<string, any> = new Map<string, any>();

    constructor(connectionService: ConnectionService, datasetService: DatasetService, filterService: FilterService,
        exportService: ExportService, injector: Injector, themesService: ThemesService,
        colorSchemeSrv: ColorSchemeService, ref: ChangeDetectorRef, visualizationService: VisualizationService) {
        super(connectionService, datasetService, filterService, exportService, injector, themesService, ref, visualizationService);
        this.optionsFromConfig = {
            title: this.injector.get('title', null),
            database: this.injector.get('database', null),
            table: this.injector.get('table', null),
            xField: this.injector.get('xField', null),
            yField: this.injector.get('yField', null),
            labelField: this.injector.get('labelField', null),
            colorField: this.injector.get('colorField', null),
            limit: this.injector.get('limit', 200),
            unsharedFilterField: {},
            unsharedFilterValue: ''
        };
        this.colorSchemeService = colorSchemeSrv;
        this.filters = [];
        this.mouseEventValid = false;
        this.active = {
            xField: new FieldMetaData(),
            yField: new FieldMetaData(),
            labelField: new FieldMetaData(),
            andFilters: true,
            limit: this.optionsFromConfig.limit,
            filterable: true,
            layers: [],
            xAxisIsNumeric: true,
            yAxisIsNumeric: true,
            pointLabels: [],
        };

        this.selection = {
            mouseDown: false,
            height: 20,
            width: 20,
            x: 20,
            y: 200,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0,
            visibleOverlay: false,
        };

        this.onHover = this.onHover.bind(this);
        this.xAxisTickCallback = this.xAxisTickCallback.bind(this);
        this.yAxisTickCallback = this.yAxisTickCallback.bind(this);

        let tooltipTitleFunc = (tooltips) => {
            //console.log(tooltips.length);
            return this.active.pointLabels[tooltips[0].index];
        };
        let tooltipDataFunc = (tooltips) => {
            let dataPoint = this.chart.data.datasets[tooltips.datasetIndex].data[tooltips.index];
            let xLabel;
            let yLabel;
            if (this.active.xAxisIsNumeric) {
                xLabel = dataPoint.x;
            } else {
                xLabel = this.chart.data.xLabels[dataPoint.x];
            }
            if (this.active.yAxisIsNumeric) {
                yLabel = dataPoint.y;
            } else {
                yLabel = this.chart.data.yLabels[dataPoint.y];
            }
            return this.active.xField.prettyName + ': ' + xLabel + '  ' + this.active.yField.prettyName + ': ' + yLabel;
        };

        this.chart = {
            type: 'scatter',
            data: new ScatterPlotData(),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                //onClick: this.onClick.bind(this),
                //onTouchStart: this.touchStart.bind(this),
                animation: {
                  duration: 0, // general animation time
                },
                hover: {
                    mode: 'point',
                    intersect: false,
                    onHover: this.onHover
                },
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            callback: this.xAxisTickCallback
                        },
                        position: 'bottom',
                        type: 'linear'
                    }],
                    yAxes: [{
                        ticks: {
                            callback: this.yAxisTickCallback
                        },
                        type: 'linear'
                    }]
                },
                tooltips: {
                    callbacks: {
                        title: tooltipTitleFunc.bind(this),
                        label: tooltipDataFunc.bind(this)
                    }
                }
            }
        };
        this.chart.data.datasets.push(new ScatterDataSet(this.defaultColor));
        this.queryTitle = 'Scatter Plot';
    };
    subNgOnInit() {
        // do nothing
    };

    postInit() {
        this.executeQueryChain();
    };

    subNgOnDestroy() {
        this.chartModule['chart'].destroy();
    };

    getOptionFromConfig(field) {
        return this.optionsFromConfig[field];
    };

    subGetBindings(bindings: any) {
        bindings.xField = this.active.xField.columnName;
        bindings.yField = this.active.yField.columnName;
        bindings.labelField = this.active.labelField.columnName;
        bindings.limit = this.active.limit;
    }

    onUpdateFields() {
        this.active.xField = this.findFieldObject('xField', neonMappings.TAGS);
        this.active.yField = this.findFieldObject('yField', neonMappings.TAGS);
        this.active.labelField = this.findFieldObject('labelField', neonMappings.TAGS);
        this.meta.colorField = this.findFieldObject('colorField', neonMappings.TAGS);
    };

    createFilter(key, startDate, endDate) {
        return {
            key: key,
            startDate: startDate,
            endDate: endDate
        };
    }

    addLocalFilter(f) {
        this.filters[0] = f;
    };

    getExportFields() {
        let usedFields = [this.active.xField,
            this.active.yField,
            this.active.labelField];
        return usedFields
          .filter((header) => header && header.columnName)
          .map((header) => {
              return {
                  columnName: header.columnName,
                  prettyName: header.prettyName
              };
          });
    }

    /**
    * returns -1 if cannot be found
    */
    getPointXLocationByIndex(chart, index): number {
        let dsMeta = chart.controller.getDatasetMeta(0);
        if (dsMeta.data.length > index) {
            let pointMeta = dsMeta.data[index];
            return pointMeta.getCenterPoint().x;
        }
        return -1;
    }

    forcePosInsideChart(pos, min, max) {
        if (pos < min) {
            pos = min;
        } else if (pos > max) {
            pos = max;
        }
        return pos;
    }

    legendItemSelected(data: any): void {
        let key = data.value;

        // Chartjs only seem to update if the entire data object was changed
        // Create a copy of the data object to set at the end
        let chartData: ScatterPlotData = {
            xLabels: this.chart.data.xLabels,
            yLabels: this.chart.data.yLabels,
            labels: this.chart.data.labels,
            datasets: this.chart.data.datasets
        };

        if (data.currentlyActive) {
            let updatedDatasets = [];
            // Search for the dataset and move it to the disabled map
            for (let dataset of chartData.datasets) {
                if (dataset.label === key) {
                    this.disabledDatasets.set(key, dataset);
                } else {
                    updatedDatasets.push(dataset);
                }
            }
            // Put something in the disabled dataset map, so the value will be marked as disabled
            if (!this.disabledDatasets.get(key)) {
                this.disabledDatasets.set(key, null);
            }
            chartData.datasets = updatedDatasets;
        } else {
            // Check the disabled map and move it back to the normal data
            let dataset = this.disabledDatasets.get(key);
            if (dataset) {
                chartData.datasets.push(dataset);
            }
            // Make sure to remove the key frm the map
            this.disabledDatasets.delete(key);
        }

        // Update the display
        this.chart.data = chartData;
        this.refreshVisualization();
        this.disabledList = Array.from(this.disabledDatasets.keys());
    }

    /*onClick(event) {
        console.log(event);
    }*/

    mouseLeave(event) {
        //console.log('leave');
        //console.log(event);
        this.mouseEventValid = false;
        this.selection.mouseDown = false;
        this.stopEventPropagation(event);
        this.changeDetection.detectChanges();
    }

    mouseDown(event) {
        //console.log('down');
        //console.log(event);
        if (event.buttons > 0) {
            this.mouseEventValid = true;
        }
    }

    mouseUp(event) {
        //console.log('up');
        //console.log(event);
        if (this.selection.mouseDown && event.buttons === 0) {
            // mouse up event
            this.selection.mouseDown = false;
            if (this.mouseEventValid) {
                let filter = this.getFilterFromSelectionPositions();
                this.addLocalFilter(filter);
                this.addNeonFilter(true, filter);
            }
        }
        this.stopEventPropagation(event);
        this.changeDetection.detectChanges();
        if (event.buttons === 0) {
            this.mouseEventValid = false;
        }
    }

    onHover(event) {
        let chartArea = this.chartModule['chart'].chartArea;
        let chartXPos = event.offsetX;
        let chartYPos = event.offsetY;
        if (!this.selection.mouseDown && event.buttons > 0 && this.mouseEventValid) {
            // mouse down event
            console.log(event);
            this.selection.mouseDown = true;
            this.selection.startX = this.forcePosInsideChart(chartXPos, chartArea.left, chartArea.right);
            this.selection.startY = this.forcePosInsideChart(chartYPos, chartArea.top, chartArea.bottom);
        }

        //console.log(chartXPos);

        if (this.selection.mouseDown && this.mouseEventValid) {
            // drag event near items
            //console.log(chartXPos);
            this.selection.endX = this.forcePosInsideChart(chartXPos, chartArea.left, chartArea.right);
            this.selection.endY = this.forcePosInsideChart(chartYPos, chartArea.top, chartArea.bottom);
            //console.log(this.selection.endX);
            this.selection.x = Math.min(this.selection.startX, this.selection.endX);
            this.selection.y = Math.min(this.selection.startY, this.selection.endY);
            this.selection.width = Math.abs(this.selection.startX - this.selection.endX);
            this.selection.height = Math.abs(this.selection.startY - this.selection.endY);
            //console.log("x: " + this.selection.startX + " " + this.selection.endX);
            //console.log(this.selection.x + " " + this.selection.width);
        }
        this.stopEventPropagation(event);
        this.changeDetection.detectChanges();
    }

    getFilterFromSelectionPositions() {
        let chart = this.chartModule['chart'];
        let x1 = chart.scales['x-axis-1'].getValueForPixel(this.selection.startX);
        let y1 = chart.scales['y-axis-1'].getValueForPixel(this.selection.startY);
        let x2 = chart.scales['x-axis-1'].getValueForPixel(this.selection.endX);
        let y2 = chart.scales['y-axis-1'].getValueForPixel(this.selection.endY);
        let temp = Math.max(x1, x2);
        x1 = Math.min(x1, x2);
        x2 = temp;
        temp = Math.max(y1, y2);
        y1 = Math.min(y1, y2);
        y2 = temp;
        if (!this.active.xAxisIsNumeric) {
            let i = Math.ceil(x1);
            x1 = this.chart.data['xLabels'][i];
            i = Math.floor(x2);
            x2 = this.chart.data['xLabels'][i];
        }
        if (!this.active.yAxisIsNumeric) {
            let i = Math.ceil(y1);
            y1 = this.chart.data['yLabels'][i];
            i = Math.floor(y2);
            y2 = this.chart.data['yLabels'][i];
        }
        return {
            xMin: x1, xMax: x2, yMin: y1, yMax: y2,
            xField: this.active.xField.columnName, yField: this.active.yField.columnName
        };
    }

    createNeonFilterClauseEquals(_databaseAndTableName: {}, fieldNames: string[]) {
        let filterClauses = [];
        let xField = fieldNames[0];
        let yField = fieldNames[1];
        let filter = this.filters[0];
        filterClauses[0] = neon.query.where(xField, '>=', filter.xMin);
        filterClauses[1] = neon.query.where(xField, '<=', filter.xMax);
        filterClauses[2] = neon.query.where(yField, '>=', filter.yMin);
        filterClauses[3] = neon.query.where(yField, '<=', filter.yMax);
        return neon.query.and.apply(neon.query, filterClauses);
    };

    getFilterText() {
        // I.E. test - earthquakes - time = 10/11/2015 to 5/1/2016"
        /*let database = this.meta.database.name;
        let table = this.meta.table.name;
        let field = this.active.dateField.columnName;
        let text = database + ' - ' + table + ' - ' + field + ' = ';
        let date = this.selection.startDate;
        text += (date.getUTCMonth() + 1) + '/' + date.getUTCDate() + '/' + date.getUTCFullYear();
        date = this.selection.endDate;
        text += ' to ';
        text += (date.getUTCMonth() + 1) + '/' + date.getUTCDate() + '/' + date.getUTCFullYear();
        return text;*/
        return '';
    }

    getNeonFilterFields() {
        return [this.active.xField.columnName, this.active.yField.columnName];
    }
    getVisualizationName() {
        return 'Scatter Plot';
    }

    refreshVisualization() {
        this.chartModule['chart'].update();
    }

    isValidQuery() {
        let valid = true;
        valid = (this.meta.database && this.meta.database.name && valid);
        valid = (this.meta.table && this.meta.table.name && valid);
        valid = (this.active.xField && this.active.xField.columnName && valid);
        valid = (this.active.yField && this.active.yField.columnName && valid);
        //valid = (this.active.labelField && valid);
        return valid;
    }

    createQuery(): neon.query.Query {
        let databaseName = this.meta.database.name;
        let tableName = this.meta.table.name;
        let query = new neon.query.Query().selectFrom(databaseName, tableName);
        let whereClauses = [];
        let xField = this.active.xField.columnName;
        let yField = this.active.yField.columnName;
        whereClauses.push(neon.query.where(xField, '!=', null));
        whereClauses.push(neon.query.where(yField, '!=', null));
        let groupBys: any[] = [];
        groupBys.push(xField);
        groupBys.push(yField);
        if (this.active.labelField && this.active.labelField.columnName !== '') {
            whereClauses.push(neon.query.where(this.active.labelField.columnName, '!=', null));
            groupBys.push(this.active.labelField);
        }
        // Check for unshared filters
        if (this.hasUnsharedFilter()) {
            whereClauses.push(neon.query.where(this.meta.unsharedFilterField.columnName, '=',
                this.meta.unsharedFilterValue));
        }
        if (this.hasColorField()) {
            whereClauses.push(neon.query.where(this.meta.colorField.columnName, '!=', null));
            groupBys.push(this.meta.colorField.columnName);
        }

        query = query.groupBy(groupBys);
        query = query.sortBy(xField, neon.query['ASCENDING']);
        query.where(neon.query.and.apply(query, whereClauses));
        query = query.limit(this.active.limit);
        query = query.aggregate(neon.query['COUNT'], '*', 'value');
        return query;
    };

    getFiltersToIgnore() {
        return null;
    }

    isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    onQuerySuccess(response) {
        this.disabledList = [];
        this.disabledDatasets.clear();

        //TODO much of this method could be optimized, but we'll worry about that later
        let xField = this.active.xField.columnName;
        let yField = this.active.yField.columnName;
        let colorField = this.meta.colorField.columnName;
        let hasColor = this.hasColorField();

        let data = response.data;
        let xAxisIsNumeric = true;
        let yAxisIsNumeric = true;
        let xAxisLabels = [];
        let yAxisLabels = [];
        this.active.pointLabels = [];

        // Map of colorField value to scatter data
        let dataSetMap = new Map<string, ScatterDataSet>();

        for (let point of data) {
            let x = point[xField];
            let y = point[yField];
            let p = {
                'x': x,
                'y': y
            };

            // The key of the dataset is the value of the color field, or ''
            let dataSetKey = '';
            if (hasColor) {
                dataSetKey = point[colorField];
            }

            let dataSet = dataSetMap.get(dataSetKey);
            if (!dataSet) {
                let color = this.defaultColor;
                if (hasColor) {
                    color = this.colorSchemeService.getColorFor(this.meta.colorField.columnName, dataSetKey);
                }
                dataSet = new ScatterDataSet(color);
                dataSet.label = dataSetKey;
                dataSetMap.set(dataSetKey, dataSet);
            }

            xAxisLabels.push(x);
            yAxisLabels.push(y);
            xAxisIsNumeric = xAxisIsNumeric && this.isNumber(x);
            yAxisIsNumeric = yAxisIsNumeric && this.isNumber(y);

            dataSet.data.push(p);
            let label = '';
            if (point.hasOwnProperty(this.active.labelField.columnName)) {
                label = point[this.active.labelField.columnName];
            }
            this.active.pointLabels.push(label);
        }

        // Un-map the data sets
        let allDataSets = Array.from(dataSetMap.values());

        if (xAxisIsNumeric) {
            this.chart.data.xLabels = xAxisLabels;
        } else {
            let xLabels = this.removeDuplicatesAndSort(xAxisLabels);
            this.chart.data.xLabels = xLabels;
            for (let dataSet of allDataSets) {
                for (let p of dataSet.data) {
                    let val = p.x;
                    p.x = xLabels.indexOf(val);
                }
            }
        }

        if (yAxisIsNumeric) {
            this.chart.data.yLabels = yAxisLabels;
        } else {
            let yLabels = this.removeDuplicatesAndSort(yAxisLabels);
            this.chart.data.yLabels = yLabels;
            for (let dataSet of allDataSets) {
                for (let p of dataSet.data) {
                    let val = p.y;
                    p.y = yLabels.indexOf(val);
                }
            }
        }
        this.chart.data.labels = this.chart.data.xLabels;

        this.chart.data.datasets = allDataSets;
        this.active.xAxisIsNumeric = xAxisIsNumeric;
        this.active.yAxisIsNumeric = yAxisIsNumeric;

        this.refreshVisualization();
        this.queryTitle = 'Scatter Plot: ' + this.active.xField.prettyName + ' vs ' + this.active.yField.prettyName;
        // Force the legend to update
        this.colorByFields = [this.meta.colorField.columnName];
    };


    xAxisTickCallback(value): string {
        if (this.active.xAxisIsNumeric) {
            return value;
        }
        let t = this.chart.data.xLabels[value];
        if (t !== undefined) {
            return t;
        }
        return '';
    }

    yAxisTickCallback(value): string {
        if (this.active.yAxisIsNumeric) {
            return value;
        }
        let t = this.chart.data.yLabels[value];
        if (t !== undefined) {
            return t;
        }
        return '';
    }

    removeDuplicatesAndSort(arr) {
        arr = arr.sort();
        arr = arr.filter(function(item, pos, ary) {
            return !pos || item !== ary[pos - 1];
        });
        return arr;
    }

    setupFilters() {
        // Do nothing
    }

    handleChangeLimit() {
        this.logChangeAndStartQueryChain();
    }

    handleChangeXField() {
        this.logChangeAndStartQueryChain(); // ('dateField', this.active.dateField.columnName);
    };

    handleChangeYField() {
        this.logChangeAndStartQueryChain(); // ('dateField', this.active.dateField.columnName);
    };

    handleChangeLabelField() {
        this.logChangeAndStartQueryChain(); // ('dateField', this.active.dateField.columnName);
    };

    handleChangeColorField() {
        this.logChangeAndStartQueryChain(); // ('dateField', this.active.dateField.columnName);
    };

    handleChangeAndFilters() {
        this.logChangeAndStartQueryChain(); // ('andFilters', this.active.andFilters, 'button');
        // this.updateNeonFilter();
    };

    unsharedFilterChanged() {
        this.logChangeAndStartQueryChain();
    }

    unsharedFilterRemoved() {
        this.logChangeAndStartQueryChain();
    }

    // Get filters and format for each call in HTML
    getCloseableFilters() {
        if (this.filters.length > 0) {
            return ['Scatter Filter'];
        } else {
            return [];
        }
    };

    getFilterTitle(/*value: string*/) {
        return this.active.xField.columnName + ' vs ' + this.active.yField.columnName;
    };

    getFilterCloseText(value: string) {
        return value;
    };

    getRemoveFilterTooltip(/*value: string*/) {
        return 'Delete Filter ' + this.getFilterTitle();
    };

    removeFilter(/*value: string*/) {
        this.filters = [];
    }
}

export class ScatterPlotFilter {
    xMin: any;
    xMax: any;
    yMin: any;
    yMax: any;
    xField: string;
    yField: string;
};
