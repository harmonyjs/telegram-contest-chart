export interface Event {
    [prop: string]: any
};

export type Callback = (event?: Event) => void;

export default class EventEmitter {

    private _events: {
        [name: string]: Array<Callback>
    }

    constructor() {
        this._events = {};
    }

    emit(name: string, event?: Event) {
        (this._events[name] || []).forEach(cb => cb(event));
        return this;
    }

    on(name: string, cb: Callback) {
        if (typeof cb !== 'function') {
          throw new Error('Listener must be a function')
        }
        (this._events[name] = this._events[name] || []).push(cb);
        return this;
    }

}