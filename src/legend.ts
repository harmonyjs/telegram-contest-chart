import Chart, { ChartDataObject } from './chart';
import Line from './line';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import { Y_TICK_HEIGHT } from './constants';
import render from './render';
import EventEmitter, { Event } from './event-emitter';

export interface LegendChangeEvent extends Event {
    alias: string;
    state: boolean;
};

type LegendOptions = {
    data: ChartDataObject
};

export default class Legend extends EventEmitter {

    container: HTMLDivElement;

    data: ChartDataObject;

    state: {
        [alias: string]: boolean;
    }

    constructor(private options: LegendOptions) {
        super();

        this.container = document.createElement("div");
        this.container.classList.add("tgc-legend");
        this.data = options.data;

        let html = '';

        const aliases = Object.keys(this.data.names);

        this.state = aliases.reduce((obj, alias) => ({ ...obj, [alias]: true }), {})

        aliases.forEach(alias => {
            const name = this.data.names[alias];
            const color = this.data.colors[alias];
            html += `
                <div class="tgc-legend__item" data-alias="${alias}" data-visible="true">
                    <div class="tgc-legend__icon" style="background-color: ${color}">
                        ${this.getSvgIcon()}
                    </div>
                    <div class="tgc-legend__name">${name}</div>
                </div>
            `;
        });
        this.container.innerHTML = html;
        this.container.addEventListener('click', this.handleClick.bind(this));
    }

    getContainer() {
        return this.container;
    }

    appendTo(el: Element) {
        el.append(this.container);
    }

    handleClick(event: MouseEvent) {
        const target = event.target as HTMLDivElement;
        const item = target.closest(".tgc-legend__item") as HTMLDivElement;
        if (item === null) return;
        const alias = item.dataset.alias;
        if (!alias) return;
        const isLast = Object.values(this.state).filter(Boolean).length === 1;
        const state = !this.state[alias];
        if (state === false && isLast) {
            // TODO notification?
            return;
        }
        this.state[alias] = state;
        item.dataset.visible = String(state); 
        this.emit('change', {
            alias,
            state
        });
    }

    getSvgIcon() {
        return `
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 3.31a1.13 1.13 0 0 1 1.6 0L5 5.71 9.8.91a1.13 1.13 0 0 1 1.6 1.6L5 8.91l-4-4a1.13 1.13 0 0 1 0-1.6z" />
            </svg>
        `;
    }
}