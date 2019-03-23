export type MonitorOptions = {
    
};

type InfoDataValue = string | number | Array<string | number> | {}

type InfoDataObject = {
    [key: string]: InfoDataValue
};

export default class Monitor {

    container: HTMLDivElement;

    domains: {
        [key: string]: InfoDataObject
    };

    constructor(private options: MonitorOptions) {

        this.domains = {};

        this.container = document.createElement("div");
        this.container.classList.add("tgc-monitor");


    }

    set(domain: string, data: InfoDataObject) {
        this.domains[domain] = Object.assign(
            this.domains[domain] || {},
            data
        );
        this.render();
    }

    render() {
        this.container.innerHTML = this.objToString(
            this.domains,
            (domainDame: string, data: InfoDataObject) => `
                <div>
                    <b>${domainDame}</b>
                    ${this.objToString(data, (name: string, value: InfoDataValue) => `
                        <div>${name}: ${value}</div>
                    `)}
                </div>
            `
        );
    }

    objToString(obj: Object, callback: (name: string, obj: any) => string): string {
        let html = '';
        for (const [name, data] of Object.entries(obj)) {
            html += callback(name, data);
        }
        return html;
    }

    getContainer() {
        return this.container;
    }

    appendTo(el: Element) {
        // TODO resize
        el.append(this.container);
    }


}