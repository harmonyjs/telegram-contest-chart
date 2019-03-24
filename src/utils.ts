export type InterpolationFunction = (e: number) => number;

export function interpolate(a: number, b: number): InterpolationFunction {
    const c = +a;
    const d = b - c;
    return function(e: number, f?: number) {
        return c + d * e;
    };
}

export function toInt(n: number): number {
    return n | 0;
}

export function minmax(min: number, value: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function easeInOutCubic(t: number): number { 
    return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 
};

export function linear(t: number) { 
    return t; 
};

export type AnimationOptions = {
    from: number, 
    to: number, 
    seconds: number,
    isLinear?: boolean,
    startTime?: number,
    callback?: Function
};

export type AnimationCallback = {
    (): number;
    from: number;
    to: number;
    finished: boolean;
}

export function animation(options: AnimationOptions): AnimationCallback {
    const { from, to, seconds, isLinear = false, startTime = Date.now(), callback } = options;
    const duration = seconds * 1000;
    const endTime = startTime + duration;
    const delta = to - from;
    const easing = isLinear ? linear : easeInOutCubic;
    function getValue() {
        if (delta === 0 || seconds === 0) {
            getValue.finished = true;
            return to;
        }
        if (getValue.finished) {
            return to;
        }
        const now = Date.now();
        const left = Math.max(0, endTime - now);
        const progress = easing((duration - left) / duration);
        if (progress === 1) {
            if (typeof callback === 'function') {
                callback();
            }
            getValue.finished = true;
            return to;
        }
        return from + delta * progress;
    };
    getValue.from = from;
    getValue.to = to;
    getValue.finished = false;
    return getValue;
}

export function handleEvent(event: MouseEvent | TouchEvent) {
    if ((event as TouchEvent).changedTouches) {
        const e = event as TouchEvent;
        const touches = e.changedTouches;
        const first = touches[0];
        return {
            clientX: first.clientX,
            target: first.target
        }
    }
    const e = event as MouseEvent;
    return {
        clientX: e.clientX,
        target: e.target
    }
}

export function round(num: number, d: number = 10): number {
    return Math.round(num * d) / d;
}

export function humanNumber(num: number): string | number {
  if (num >= 1000000)
    return round(num/1000000) + 'M';
  if (num >= 1000)
    return round(num/1000)+'K';
  return round(num);
}

export function className(block: string, element?: string, mod?: string): string {
    let c = `tgc-${block}`;
    if (element) {
        c += '__' + element;
    }
    if (mod) {
        c += '-' + mod;
    }
    return c;
}

export function join(...args: (string|number)[]): string {
    return args.join('');
}

export type DivFunction = (...args: string[]) => string;

export type StyleObject = {
    [name: string]: string | number
};

export function div(block: string, element?: string, mod?: string, style?: StyleObject): DivFunction {
    return function(...children: (string|number)[]): string {
        let s;
        if (style) {
            const propsString = join(...Object.keys(style).map(prop => `${prop}: ${style[prop]};`));
            s = `style="${propsString}"`;
        }
        return `<div class="${className(block, element, mod)}" ${s}>${join(...children)}</div>`;
    }
}

export function divWithStyle(classNameArgs: string[], style: StyleObject) {
    const [b, e, m] = classNameArgs;
    return div(b, e, m, style);
}

export function on(el: HTMLElement, eventName: string, handler: Function, ctx: Object) {
    el.addEventListener(eventName, handler.bind(ctx));
}

export function transform(el: HTMLElement, value: string) {
    el.style.transform = value;
}

export function translateX(num: number): string {
    return `translateX(${num}px)`;
}

export function find(container: HTMLElement, className: string): HTMLElement {
    const el = container.querySelector('.' + className) as HTMLElement;
    if (el === null) {
        throw new Error('Something went wrong');
    }
    return el;
}