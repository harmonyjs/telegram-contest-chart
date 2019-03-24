import Line from './line';
import { on, translateX, transform, humanNumber, join, div, className, minmax, interpolate, InterpolationFunction, animation, AnimationCallback, divWithStyle, find } from './utils';
import Brush, { BrushChangeEvent } from './brush';
import YAxis from './y-axis';
import XAxis from './x-axis';
import Legend, { LegendChangeEvent } from './legend';
import render from './render';
import { X_TYPE, LINE_TYPE, CHART_PADDING, CHART_POINTS_PADDING_RIGHT, Y_AXIS_ANIMATION_DURATION, BRUSH_HEIGHT, WIDTH_HEIGHT_RATIO } from './constants';

export type Viewport = {
    width: number,
    height: number
};

export type ChartColumn = Array<string|number>;

export type ChartDataObject = {
    columns: ChartColumn[],
    types: {
        [name: string]: string;
    },
    names: {
        [name: string]: string;
    },
    colors: {
        [name: string]: string;
    }
};

export type ChartOptions = {
    container: HTMLElement | null;
    data: ChartDataObject;
    title?: string;
    width?: number;
    height?: number;
};

export default class Chart {

    container: HTMLElement;
    popover: HTMLElement;
    popoverDate: HTMLElement;
    popoverValues: HTMLElement;
    chartCursor: HTMLElement;

    viewportRect: DOMRect | ClientRect;
    viewport: {
        width: number,
        height: number
    };

    data: ChartDataObject;

    width: number;
    height: number;

    interpolateX: InterpolationFunction;
    interpolateXWithoutPadding: InterpolationFunction;
    
    lines: Line[] = [];
    brushLines: Line[] = [];
    xData: number[];

    brush: Brush;
    yAxis: YAxis;
    xAxis: XAxis;
    legend: Legend;

    _maxValueAnimation?: AnimationCallback;
    _currentMaxValueAnimation?: AnimationCallback;

    private _prevMax?: number;
    private _prevCurrentMax?: number;

    constructor(private options: ChartOptions) {
        const self = this;
        const chart = self;
        const { container, data, width, height, title } = options;

        if (container === null) {
            throw new Error(`container is mandatory`);
        }

        self.container = container;
        self.data = data;
        self.width = width || self.getContainerWidth() || 0;
        self.height = height || ((self.width * WIDTH_HEIGHT_RATIO) | 0) || 0;

        self.interpolateX = interpolate(0, self.width - CHART_POINTS_PADDING_RIGHT);
        self.interpolateXWithoutPadding = interpolate(0, self.width);

        self.container.classList.add(className('chart'));
        self.container.innerHTML = join(
            div('chart', 'title')(title||''),
            div('viewport')(
                div('lines')(),
                div('cursor')(),
                div('popover')(
                    div('popover', 'date')(),
                    div('popover', 'values')()
                )
            )
        );

        if (width) {
            self.container.style.width = `${width}px`;
        }
        if (height) {
            self.container.style.height = `${height}px`;
        }
        
        self.popover = find(container, className('popover'));
        self.popoverDate = find(container, className('popover', 'date'));
        self.popoverValues = find(container, className('popover', 'values'));
        self.chartCursor = find(container, className('cursor'));

        // 
        // Get viewport size
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        const viewportContainer = find(container, className('viewport'));
        self.viewportRect = viewportContainer.getBoundingClientRect();
        const { top, left, right, bottom } = self.viewportRect;
        self.viewport = {
            width: (right - left) || self.width,
            height: (bottom - top) || self.height
        };

        on(viewportContainer, 'mouseenter', self.handleMouseEnter, self);
        on(viewportContainer, 'mouseleave', self.handleMouseLeave, self);
        on(viewportContainer, 'mousemove', self.handleMouseMove, self);
        
        // 
        // Create brush and append to container
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.brush = new Brush({ chart });

        // 
        // X Axis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.xAxis = new XAxis({ chart });

        // 
        // Legend
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.legend = new Legend({ data });
        self.legend.on('change', self.handleLegendChange.bind(self));

        // append components
        self.xAxis.appendTo(self.container);
        self.brush.appendTo(self.container);
        self.legend.appendTo(self.container);
        
        self.createLines();

        const linesContainer = find(container, className('lines'));
        linesContainer.append(...self.lines.map(line => line.getContainer()));

        self.brush.on('change', self.handleWindowChange.bind(self));

        self.brush.addLines(self.brushLines);

        self.xAxis.addData(self.xData);

        // 
        // YAxis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.yAxis = new YAxis({
            chart,
            viewport: self.viewport
        });
        self.yAxis.appendTo(viewportContainer);

        // pre render for lines
        self.lines.forEach(line => line.render());
        self.brushLines.forEach(line => line.render());
    }

    createLines() {
        const self = this;
        const { columns, types, names, colors } = self.data;
        const { width, height } = self.viewport;
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const [alias, ...dataArray] = column;
            const data = dataArray as number[];
            const type = types[alias];
            if (type === X_TYPE) {
                self.xData = data;
                continue;
            }
            const name = names[alias];
            const color = colors[alias];

            const options = {
                chart: self,
                alias: alias as string,
                name,
                color,
                data,
                width,
                height,
                className: className('line'),
                isBrush: false
            };

            const line = new Line(options);
            self.lines.push(line);

            const brushLine = new Line({
                ...options,
                height: BRUSH_HEIGHT,
                className: className('brush', 'line'),
                isBrush: true
            });
            self.brushLines.push(brushLine);
        }
    }

    render(recursive: boolean = false) {
        const self = this;
        if (recursive && !self._maxValueAnimation && !self._currentMaxValueAnimation && !self.brush.hasAnimation()) {
            return;
        }
        render('lines render', () => {
            self.lines.forEach(line => line.render());
            self.brushLines.forEach(line => line.render());
            self.render(true);
        });
    }

    handleWindowChange() {
        this.render();
    }

    handleLegendChange(event: LegendChangeEvent) {
        const self = this;
        const line = self.getLine(self.lines, event.alias);
        line[event.state ? 'show' : 'hide']();
        const brushLine = self.getLine(self.brushLines, event.alias);
        brushLine[event.state ? 'show' : 'hide']();
        self.render();
    }

    handleMouseEnter(e: MouseEvent | TouchEvent) {
        render('show popover', () => {
            this.popover.style.opacity = '1';
            this.chartCursor.style.opacity = '1';
        });
    }

    handleMouseLeave() {
        render('hide popover', () => {
            this.popover.style.opacity = '0';
            this.chartCursor.style.opacity = '0';
            this.lines.forEach(line => {
                line.hidePoint()
            });
        });
    }

    handleMouseMove(e: MouseEvent) {
        render('move popover', () => {
            const self = this;
            const { exact: { startWith, endAt, length } } = self.brush.getWindow();
            const int = interpolate(startWith, endAt);
            const point = Math.round(int((e.clientX - self.viewportRect.left) / (self.width - CHART_POINTS_PADDING_RIGHT)));

            if (!self.xAxis.data[point]) {
                return;
            }

            const dateString = self.xAxis.getDate(point);
            self.popoverDate.innerHTML = dateString;

            const values = self.lines.map(line => {
                line.showPoint(point);
                return {
                    name: line.name,
                    value: line.data[point],
                    color: line.color
                }
            });

            self.popoverValues.innerHTML = join(...values.map(({ value, color, name }) => 
                divWithStyle(['popover', 'value'], { color })(
                    div('popover', 'number')(humanNumber(value) as string),
                    div('popover', 'name')(name),
                )
            ));

            const px = self.interpolateX((point - startWith) / length);

            const { left: popoverLeft, right: popoverRight } = self.popover.getBoundingClientRect();
            const width = popoverRight - popoverLeft;
            const half = width / 2;
            const x = minmax(CHART_PADDING, px - half, self.width - width - CHART_PADDING);

            transform(self.popover, translateX(x));
            transform(self.chartCursor, translateX(Math.round(minmax(1, px, self.width - 1))));
        });
    }

    getLine(lines: Line[], alias: string) {
        const line = lines.find(line => line.alias === alias);
        if (!line) {
            throw new Error('Line is not found');
        }
        return line;
    }

    getContainerWidth(): number {
        const { width } = this.container.getBoundingClientRect();
        return width;
    }

    getMax() {
        const self = this;
        const max = self.getMaxExact();
        if (self._prevMax && self._prevMax !== max) {
            const from = self._maxValueAnimation ? self._maxValueAnimation() : self._prevMax;
            self._maxValueAnimation = animation({
                from, 
                to: max, 
                seconds: Y_AXIS_ANIMATION_DURATION
            });
            self._prevMax = max;
            return self._maxValueAnimation();
        }
        if (self._maxValueAnimation) {
            const value = self._maxValueAnimation();
            if (self._maxValueAnimation.finished) {
                delete self._maxValueAnimation;
            }
            return value;
        }
        self._prevMax = max;
        return max;
    }

    getMaxExact() {
        return Math.max(...this.lines.map(line => line.getMax()));
    }

    getCurrentMax() {
        const self = this;
        const max = self.getCurrentMaxExact();
        if (self._prevCurrentMax && self._prevCurrentMax !== max) {
            const from = self._currentMaxValueAnimation ? self._currentMaxValueAnimation() : self._prevCurrentMax;
            self._currentMaxValueAnimation = animation({
                from, 
                to: max, 
                seconds: Y_AXIS_ANIMATION_DURATION
            });
            self._prevCurrentMax = max;
            return self._currentMaxValueAnimation();
        }
        if (self._currentMaxValueAnimation) {
            const value = self._currentMaxValueAnimation();
            if (self._currentMaxValueAnimation.finished) {
                delete self._currentMaxValueAnimation;
            }
            return value;
        }
        self._prevCurrentMax = max;
        return max;
    }

    getCurrentMaxExact() {
        return Math.max(...this.lines.map(line => line.getCurrentMax()));
    }

}