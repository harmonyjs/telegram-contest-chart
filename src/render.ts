export type DrawTask = () => void;

let isRunning = false;

let drawTasks: {
    [type: string]: DrawTask
} = {};

let last = 0;
let i = 0;

function loop() {
    isRunning = true;
    requestAnimationFrame((t)=> {
        if (t - last < 16) {
            loop();
            return;
        }
        last = t;
        // console.log('-------------- raf ----------------', i++);
        const keys = Object.keys(drawTasks);
        if (!keys.length) {
            isRunning = false;
            return;
        }
        const tasks = drawTasks;
        drawTasks = {};
        while(keys.length) {
            const taskKey = keys.shift() || '';
            const task = tasks[taskKey];
            if (task) {
                // console.log(taskKey);
                task();
            }
        }
        loop();
    });
}

export default function render(type: string, task: DrawTask) {
    if (drawTasks[type]) {
        // duplicate
        return;
    }
    drawTasks[type] = task;
    if (!isRunning) {
        loop();
    }
}