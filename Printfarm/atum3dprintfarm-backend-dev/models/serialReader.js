const { SerialPort, ReadlineParser } = require("serialport");

module.exports = function startSerialReader(onData) {
    const port = new SerialPort({
        path: "/dev/ttyUSB0", // or /dev/serial0 for Pi UART
        baudRate: 9600
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    parser.on("data", (line) => {
        onData(line.trim());
    });

    port.on("open", () => console.log("Serial port open"));
    port.on("error", (err) => console.error("Serial error:", err));
};
