const Printer = require("../models/printerModel");
const { SmartModuleError, validateModuleAddress } = require("../services/smartModuleClient");

const SENSOR_TYPES = ["bme280", "pir", "mcp3008"];

function validatePrinterBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be an object" };
  }
  if (!Object.prototype.hasOwnProperty.call(body, "enabledSensors")) {
    if (Object.prototype.hasOwnProperty.call(body, "raspberryPiIp") && body.raspberryPiIp) {
      try {
        validateModuleAddress(body.raspberryPiIp);
      } catch (error) {
        if (error instanceof SmartModuleError) return { error: error.message, status: error.status };
        throw error;
      }
    }
    return { value: body };
  }

  const enabledSensors = body.enabledSensors;
  if (
    !Array.isArray(enabledSensors) ||
    enabledSensors.some(
      (sensor) => typeof sensor !== "string" || !SENSOR_TYPES.includes(sensor)
    ) ||
    new Set(enabledSensors).size !== enabledSensors.length
  ) {
    return {
      error: "enabledSensors must be an array containing unique values from: bme280, pir, mcp3008",
    };
  }

  const value = {
    ...body,
    enabledSensors: SENSOR_TYPES.filter((sensor) => enabledSensors.includes(sensor)),
  };
  if (Object.prototype.hasOwnProperty.call(value, "raspberryPiIp") && value.raspberryPiIp) {
    try {
      value.raspberryPiIp = validateModuleAddress(value.raspberryPiIp);
    } catch (error) {
      if (error instanceof SmartModuleError) return { error: error.message, status: error.status };
      throw error;
    }
  }
  return { value };
}

exports.getPrinters = (req, res) => {
  res.json(Printer.getAll());
};

exports.addPrinter = (req, res) => {
  const validation = validatePrinterBody(req.body);
  if (validation.error) {
    return res.status(validation.status || 400).json({ message: validation.error });
  }

  const saved = Printer.add(validation.value);
  res.status(201).json(saved);
};

exports.updatePrinter = (req, res) => {
  const validation = validatePrinterBody(req.body);
  if (validation.error) {
    return res.status(validation.status || 400).json({ message: validation.error });
  }

  const updated = Printer.update(req.params.id, validation.value);
  if (!updated) return res.status(404).json({ message: "Printer not found" });
  res.json(updated);
};

exports.deletePrinter = (req, res) => {
  const ok = Printer.remove(req.params.id);
  if (!ok) return res.status(404).json({ message: "Printer not found" });
  res.json({ message: "Printer removed" });
};
