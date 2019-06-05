const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const CommandLineUtil = Me.imports.commandLineUtil;

var SensorsUtil = class extends CommandLineUtil.CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('sensors');
        // -A: Do not show adapter -j: JSON output
        this._argv = path ? [path, '-A', '-j'] : null;
    }

    get temp() {
        return this._parseGenericSensorsOutput(/^temp\d+_input/, 'temp');
    }

    get gpu() {
        return this._parseGpuSensorsOutput(/^temp\d+_input/, 'temp');
    }

    get rpm() {
        return this._parseGenericSensorsOutput(/^fan\d+_input/, 'rpm');
    }

    get volt() {
        return this._parseGenericSensorsOutput(/^in\d+_input/, 'volt');
    }

    _parseGenericSensorsOutput(sensorFilter, sensorType) {
        return this._parseSensorsOutput(sensorFilter, sensorType, false);
    }

    _parseGpuSensorsOutput(sensorFilter, sensorType) {
        return this._parseSensorsOutput(sensorFilter, sensorType, true);
    }

  _parseSensorsOutput(sensorFilter, sensorType, gpuFlag) {
        if(!this._output)
            return [];

        let data = []
        try {
            // data = JSON.parse(this._output.join(''));
            data = JSON.parse(`{"amdgpu-pci-0400":{
      "Adapter": "PCI adapter",
      "vddgfx":{
         "in0_input": 0.875
      },
      "fan1":{
         "fan1_input": 3699.000,
         "fan1_min": 0.000,
         "fan1_max": 7000.000
      },
      "temp1":{
         "temp1_input": 41.000,
         "temp1_crit": 97.000,
         "temp1_crit_hyst": -273.150
      },
      "power1":{
         "power1_average": 7.051,
         "power1_cap": 35.000
      }
   }}`);
        } catch (e) {
          try {
            // fix for wrong lm_sensors output
            // https://github.com/UshakovVasilii/gnome-shell-extension-freon/issues/114#issuecomment-491613545
            let lineRemoved = this._output.filter(l => l.trim() !== ',').join('\n');
            let errorRemoved = lineRemoved.replace(/ERROR.*Can't read/, "");
            errorRemoved = errorRemoved.replace(/ERROR.*I\/O error/, "");
            data = JSON.parse(errorRemoved);
          } catch (e) {
            global.log(e.toString());
            return [];
          }
        }

        let sensors = [];
        for (var chipset in data) {
            let gpuFilter = /(radeon|amdgpu|nouveau)/;
            if (!data.hasOwnProperty(chipset) || (gpuFlag != gpuFilter.test(chipset) && sensorType === 'temp'))
                continue;

            let chipsetSensors = data[chipset]
            for (var sensor in chipsetSensors) {
                if (!chipsetSensors.hasOwnProperty(sensor))
                    continue;

                let fields = chipsetSensors[sensor];
                for (var key in fields) {
                    if (fields.hasOwnProperty(key) && sensorFilter.test(key)) {
                        let feature = {
                            label: sensor,
                            [sensorType]: parseFloat(fields[key])
                        };
                        sensors.push(feature);
                        break;
                    }
                }
            }
        }
        return sensors;
    }
};
