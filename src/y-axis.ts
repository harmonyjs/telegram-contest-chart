import Chart, { Viewport } from './chart';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import { Y_TICK_HEIGHT } from './constants';
import render from './render';

export type YAxisOptions = {
    chart: Chart;
    viewport: Viewport;
};

enum TICK_PLACE {
    UP = 'up',
    CURRENT = 'current',
    DOWN = 'down'
}

export default class YAxis {

    chart: Chart;

    container: HTMLDivElement;

    viewport: Viewport;

    max: number;
    oneTick: number;
    numOfTicks: number;

    toHeight: InterpolationFunction;
    toValue: InterpolationFunction;

    private _tickPosition: {
        [key: string]: number
    } = {};

    constructor(private options: YAxisOptions) {
        this.chart = options.chart;
        this.viewport = options.viewport;

        this.container = document.createElement("div");
        this.container.classList.add("tgc-y");

        this.max = this.chart.getCurrentMax();

        this.toHeight = interpolate(0, this.viewport.height);
        this.toValue = interpolate(0, this.max);

        this.numOfTicks = 5;//Math.floor(height / Y_TICK_HEIGHT);
        this.oneTick = Math.floor(this.max / this.numOfTicks);
        const tickHeight = this.viewport.height / this.numOfTicks;

        let html = '';
        
        for (let i = 0; i < this.numOfTicks; i++) {
            const value = this.oneTick * i;
            html += `<div class="tgc-y__num tgc-y__num-up" style="transform: translateY(-${this.getTickPosition(i, TICK_PLACE.UP)}px)"></div>`;
            html += `<div class="tgc-y__num tgc-y__num-current" style="transform: translateY(-${this.getTickPosition(i, TICK_PLACE.CURRENT)}px)">${value}</div>`;
            html += `<div class="tgc-y__num tgc-y__num-down" style="transform: translateY(-${this.getTickPosition(i, TICK_PLACE.DOWN)}px)"></div>`;
        }
        
        this.container.innerHTML = html;

        
        this.chart.brush.on('change', this.handleWindowChange.bind(this));
        this.chart.legend.on('change', this.handleWindowChange.bind(this));
        
        // setInterval(() => this.handleWindowChange(), 1000);
    }

    getTickPosition(index: number, place: TICK_PLACE) {
        const key = `${place}_${index}`;
        if (this._tickPosition[key] !== undefined) {
            return this._tickPosition[key];
        }
        let position = this.toHeight(index / this.numOfTicks);
        switch(place) {
            case TICK_PLACE.UP:
                position = position && (this.viewport.height / 2 + position * 2);
                break;
            case TICK_PLACE.DOWN:
                position = position / 2;
                break;
        }
        return this._tickPosition[key] = position;
    }

    handleWindowChange() {
        if (this.max === this.chart.getCurrentMaxExact()) {
            return;
        }
        render('y-axis', this.updateAxis.bind(this));
    }

    updateAxis() {
        const prevMax = this.max;
        this.max = this.chart.getCurrentMaxExact();

        this.oneTick = Math.floor(this.max / this.numOfTicks);

        const tickEls = Array.from(this.container.querySelectorAll('.tgc-y__num-current'));
        const upTickEls = Array.from(this.container.querySelectorAll('.tgc-y__num-up'));
        const downTickEls = Array.from(this.container.querySelectorAll('.tgc-y__num-down'));
        
        const nextClass = (
            this.max < prevMax ? { current: 'tgc-y__num-up', up: 'tgc-y__num-down', down: 'tgc-y__num-current' }
                               : { current: 'tgc-y__num-down', up: 'tgc-y__num-current', down: 'tgc-y__num-up' }
        );

        const nextPosition = (
            this.max < prevMax ? { current: TICK_PLACE.UP, up: TICK_PLACE.DOWN, down: TICK_PLACE.CURRENT }
                               : { current: TICK_PLACE.DOWN, up: TICK_PLACE.CURRENT, down: TICK_PLACE.UP }
        );

        for (let i = 1; i < this.numOfTicks; i++) {
            const upEl = upTickEls[i] as HTMLDivElement;
            const downEl = downTickEls[i] as HTMLDivElement;
            const currentEl = tickEls[i] as HTMLDivElement;
            const value = this.oneTick * i;

            if (nextPosition.up === TICK_PLACE.CURRENT) {
                upEl.innerHTML = String(value);
            }

            if (nextPosition.down === TICK_PLACE.CURRENT) {
                downEl.innerHTML = String(value);
            }

            currentEl.style.transform = `translateY(-${this.getTickPosition(i, nextPosition.current)}px)`;
            currentEl.classList.remove('tgc-y__num-current');
            currentEl.classList.add(nextClass.current);

            downEl.style.transform = `translateY(-${this.getTickPosition(i, nextPosition.down)}px)`;
            downEl.classList.remove('tgc-y__num-down');
            downEl.classList.add(nextClass.down);

            upEl.style.transform = `translateY(-${this.getTickPosition(i, nextPosition.up)}px)`;
            upEl.classList.remove('tgc-y__num-up');
            upEl.classList.add(nextClass.up);
        }
    }

    getContainer() {
        return this.container;
    }

    appendTo(el: Element) {
        el.append(this.container);
    }
}