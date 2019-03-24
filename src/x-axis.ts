import Chart, { Viewport } from './chart';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import { Y_TICK_HEIGHT, BRUSH_WINDOW_DIRECTION, X_TYPE } from './constants';
import render from './render';
import { BrushChangeEvent } from './brush';

export type XAxisOptions = {
    chart: Chart;
};

const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat'];
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default class XAxis {

    chart: Chart;

    container: HTMLDivElement;

    data: Date[] = [];

    ratio: number = 0;

    hidden: number[][] = [];
    visible: number[] = [];

    constructor(private options: XAxisOptions) {
        this.chart = options.chart;

        this.container = document.createElement("div");
        this.container.classList.add("tgc-x");

        this.chart.brush.on('change', this.handleBrushChange.bind(this));

    }
    
    getDate(point: number) {
        const date = this.data[point];
        return XAxis.shortDay(date) + ', ' + XAxis.shortMonth(date) + ' ' + date.getDate()
    }

    handleBrushChange(event: BrushChangeEvent) {
        render('x-axis', () => {
            if (
                event.action == BRUSH_WINDOW_DIRECTION.LEFT ||
                event.action == BRUSH_WINDOW_DIRECTION.RIGHT
            ) {
                this.checkVisibility();
            }
            this.shift();
            this.render();
        });
    }

    checkVisibility(): void {
        const { exact: { startWith, length } } = this.chart.brush.getWindow();
        const windowShift = this.chart.interpolateX(startWith / (length));
        const items = Array.from(this.container.querySelectorAll('.tgc-x__label'));

        const LABEL_WIDTH = 70;
        const VISIBLE_ITEMS = Math.floor(this.chart.width / LABEL_WIDTH);

        const inWindow: {[n: string]: boolean} = {};

        let visibleInWindow = 0;

        for (let i = 0; i < items.length; i++) {            
            const x = this.chart.interpolateX(i / (length)) - windowShift;
            const isInWindow = (x) >= 0 && x <= this.chart.width;
            const isVisible = this.visible.includes(i);
            if (isInWindow) {
                inWindow[i] = true;
            }
            if (isInWindow && isVisible) {
                visibleInWindow++;
            }
        }

        this.ratio = visibleInWindow / VISIBLE_ITEMS;

        if (this.ratio > 1) {
            const hidden = this.hideItems();
            return hidden > 0 ? this.checkVisibility() : void 0;
        }

        if (this.ratio < 0.5) {
            const shown = this.showItems();
            return shown > 0 ? this.checkVisibility() : void 0;
        }

    }

    showItems(): number {
        const last = this.hidden.pop();
        if (!last) {
            return 0;
        }
        this.visible.push(...last)
        this.visible.sort((a, b) => a - b);
        return last.length;
    }

    hideItems(): number {

        const items = this.visible.slice(1, this.visible.length - 1);

        const hidden: number[] = [];

        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const shouldHide = i % 2 === 0;
            if (shouldHide) {
                hidden.push(id);
            }
        }

        this.visible = this.visible.filter(id => !hidden.includes(id)).sort((a, b) => a - b);
        
        this.hidden.push(hidden);

    
        return hidden.length;
    }

    isLastHidden(id: number): boolean {
        const last = this.hidden[this.hidden.length - 1];
        if (!last) {
            return false;
        }
        return last.includes(id);
    }

    shift() {
        const { exact: { startWith, length } } = this.chart.brush.getWindow();
        const windowShift = this.chart.interpolateX(startWith / (length));
        const wrapper = this.container.querySelector('.tgc-x__wrapper') as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `translateX(-${windowShift}px)`;
        }
    }

    render() {
        const { exact: { startWith, length } } = this.chart.brush.getWindow();
        const windowShift = this.chart.interpolateX(startWith / (length));
        const items = Array.from(this.container.querySelectorAll('.tgc-x__label'));
        for (let i = 0; i < items.length; i++) {
            const item = items[i] as HTMLElement;
            const x = this.chart.interpolateX(i / (length));
            const isVisible = this.visible.find(id => id === i);
            item.style.transform = `translateX(${x - 20}px)`;
            if (isVisible) {
                item.style.opacity = '1';
            } else {
                item.style.opacity = this.isLastHidden(i) ? String(1 - this.ratio) : '0';
            }
        }
    }

    addData(data: number[]) {
        this.data = data.map(timestamp => new Date(timestamp));
        let html = '';
        html += `<div class="tgc-x__wrapper" style="transform: translateX(0)">`;
        for (let date of this.data) {
            const label = `${XAxis.shortMonth(date)} ${date.getDate()}`;
            html += `
                <div class="tgc-x__label" style="transform: translateX(-100%)">${label}</div>
            `;
        }
        html += `</div>`;
        this.container.innerHTML = html;

        const items = Array.from(this.container.querySelectorAll('.tgc-x__label'));
        this.visible = Array.from(Array(items.length).keys());

        this.checkVisibility();
        this.shift();
        this.render();
    }

    getContainer() {
        return this.container;
    }

    appendTo(el: Element) {
        el.append(this.container);
    }

    static shortMonth(date: Date) {
        return shortMonths[date.getMonth()];
    }

    static shortDay(date: Date) {
        return shortDays[date.getDay()];
    }
}