export type DrawTask = () => void;

let isRunning = false;

let drawTasks: DrawTask[] = [];

let last = 0;

function loop() {
    isRunning = true;
    requestAnimationFrame((t)=> {
        // if (t - last < 100) {
        //     loop();
        //     return;
        // }
        // last = t;
        // console.log('raf', t);
        // if (!drawTasks.length) {
        //     isRunning = false;
        //     return;
        // }
        const tasks = drawTasks;
        drawTasks = [];
        while(tasks.length) {
            const task = tasks.shift();
            if (task) {
                // console.log('task fired');
                task();
            }
        }
        loop();
    });
}

export default function render(task: DrawTask) {
    drawTasks.push(task);
    // console.log('task added');
    if (!isRunning) {
        loop();
    }
}