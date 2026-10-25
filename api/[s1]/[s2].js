// GENERATED FILE - DO NOT EDIT BY HAND.
// Built from backend/ by scripts/build-function.mjs (run `npm run build`).
// Committed because Vercel discovers /api functions from the source tree;
// the build regenerates every copy, so they can never go stale on deploy.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/postgres-array/index.js
var require_postgres_array = __commonJS({
  "node_modules/postgres-array/index.js"(exports) {
    "use strict";
    exports.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
  }
});

// node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "node_modules/pg-types/lib/arrayParser.js"(exports, module) {
    var array = require_postgres_array();
    module.exports = {
      create: function(source, transform) {
        return {
          parse: function() {
            return array.parse(source, transform);
          }
        };
      }
    };
  }
});

// node_modules/postgres-date/index.js
var require_postgres_date = __commonJS({
  "node_modules/postgres-date/index.js"(exports, module) {
    "use strict";
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module.exports = function parseDate(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    };
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign2 = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign2 * 1e3;
    }
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    function is0To99(num) {
      return num >= 0 && num < 100;
    }
  }
});

// node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/xtend/mutable.js"(exports, module) {
    module.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/postgres-interval/index.js
var require_postgres_interval = __commonJS({
  "node_modules/postgres-interval/index.js"(exports, module) {
    "use strict";
    var extend = require_mutable();
    module.exports = PostgresInterval;
    function PostgresInterval(raw) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw);
      }
      extend(this, parse(raw));
    }
    var properties = ["seconds", "minutes", "hours", "days", "months", "years"];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = ["years", "months", "days"];
    var timeProperties = ["hours", "minutes", "seconds"];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = ["hours", "minutes", "seconds", "milliseconds"];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
  }
});

// node_modules/postgres-bytea/index.js
var require_postgres_bytea = __commonJS({
  "node_modules/postgres-bytea/index.js"(exports, module) {
    "use strict";
    var bufferFrom = Buffer.from || Buffer;
    module.exports = function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    };
  }
});

// node_modules/pg-types/lib/textParsers.js
var require_textParsers = __commonJS({
  "node_modules/pg-types/lib/textParsers.js"(exports, module) {
    var array = require_postgres_array();
    var arrayParser = require_arrayParser();
    var parseDate = require_postgres_date();
    var parseInterval = require_postgres_interval();
    var parseByteA = require_postgres_bytea();
    function allowNull(fn) {
      return function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      };
    }
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    var parsePointArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseFloatArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseStringArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    };
    var parseDateArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseIntervalArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseByteAArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    };
    var parseInteger = function(value) {
      return parseInt(value, 10);
    };
    var parseBigInteger = function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    };
    var parseJsonArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    };
    var parsePoint = function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    };
    var parseCircle = function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    };
    var init = function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate);
      register(1114, parseDate);
      register(1184, parseDate);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray);
      register(3807, parseJsonArray);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    };
    module.exports = {
      init
    };
  }
});

// node_modules/pg-int8/index.js
var require_pg_int8 = __commonJS({
  "node_modules/pg-int8/index.js"(exports, module) {
    "use strict";
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign2 = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign2 = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign2 + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign2 + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign2 + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign2 + digits + result;
      }
    }
    module.exports = readInt8;
  }
});

// node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "node_modules/pg-types/lib/binaryParsers.js"(exports, module) {
    var parseInt64 = require_pg_int8();
    var parseBits = function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      };
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
      }
      return result;
    };
    var parseFloatFromBits = function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign2 = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      };
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign2 === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign2 === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    };
    var parseInt16 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    };
    var parseInt32 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    };
    var parseFloat32 = function(value) {
      return parseFloatFromBits(value, 23, 8);
    };
    var parseFloat64 = function(value) {
      return parseFloatFromBits(value, 52, 11);
    };
    var parseNumeric = function(value) {
      var sign2 = parseBits(value, 16, 32);
      if (sign2 == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign2 === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    };
    var parseDate = function(isUTC, value) {
      var sign2 = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign2 === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    };
    var parseArray = function(value) {
      var dim = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      };
      var parse = function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      };
      return parse(dims, elementType);
    };
    var parseText = function(value) {
      return value.toString("utf8");
    };
    var parseBool = function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    };
    var init = function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate.bind(null, false));
      register(1184, parseDate.bind(null, true));
      register(1e3, parseArray);
      register(1007, parseArray);
      register(1016, parseArray);
      register(1008, parseArray);
      register(1009, parseArray);
      register(25, parseText);
    };
    module.exports = {
      init
    };
  }
});

// node_modules/pg-types/lib/builtins.js
var require_builtins = __commonJS({
  "node_modules/pg-types/lib/builtins.js"(exports, module) {
    module.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// node_modules/pg-types/index.js
var require_pg_types = __commonJS({
  "node_modules/pg-types/index.js"(exports) {
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports.getTypeParser = getTypeParser;
    exports.setTypeParser = setTypeParser;
    exports.arrayParser = arrayParser;
    exports.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val) {
      return String(val);
    }
    function getTypeParser(oid, format) {
      format = format || "text";
      if (!typeParsers[format]) {
        return noParse;
      }
      return typeParsers[format][oid] || noParse;
    }
    function setTypeParser(oid, format, parseFn) {
      if (typeof format == "function") {
        parseFn = format;
        format = "text";
      }
      typeParsers[format][oid] = parseFn;
    }
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// node_modules/pg/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/pg/lib/defaults.js"(exports, module) {
    "use strict";
    var user;
    try {
      user = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
    } catch {
    }
    module.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      // SSL negotiation style: 'postgres' (traditional SSLRequest) or 'direct'
      sslnegotiation: void 0,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require_pg_types();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module.exports.__defineSetter__("parseInt8", function(val) {
      pgTypes.setTypeParser(20, "text", val ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// node_modules/pg/lib/utils.js
var require_utils = __commonJS({
  "node_modules/pg/lib/utils.js"(exports, module) {
    "use strict";
    var defaults2 = require_defaults();
    var nodeUtils = __require("util");
    var { isDate } = __require("util/types");
    var invalidDateDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Sending an invalid date to Postgres is deprecated and will throw an error in the next major version of pg. Ensure any Date object passed as a query parameter is valid.",
      "PG_INVALID_DATE"
    );
    function escapeElement(elementRepresentation) {
      const escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    function arrayString(val) {
      let result = "{";
      for (let i = 0; i < val.length; i++) {
        if (i > 0) {
          result += ",";
        }
        let item = val[i];
        if (item == null) {
          result += "NULL";
        } else if (Array.isArray(item)) {
          result += arrayString(item);
        } else if (ArrayBuffer.isView(item)) {
          if (!(item instanceof Buffer)) {
            item = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(item));
        }
      }
      result += "}";
      return result;
    }
    var prepareValue = function(val, seen) {
      if (val == null) {
        return null;
      }
      if (typeof val === "object") {
        if (val instanceof Buffer) {
          return val;
        }
        if (ArrayBuffer.isView(val)) {
          return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
        }
        if (isDate(val)) {
          if (isNaN(val.getTime())) {
            invalidDateDeprecationNotice();
          }
          if (defaults2.parseInputDatesAsUTC) {
            return dateToStringUTC(val);
          } else {
            return dateToString(val);
          }
        }
        if (Array.isArray(val)) {
          return arrayString(val);
        }
        return prepareObject(val, seen);
      }
      return val.toString();
    };
    function prepareObject(val, seen) {
      if (val && typeof val.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error('circular reference detected while preparing "' + val + '" for query');
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    }
    function dateToString(date) {
      let offset = -date.getTimezoneOffset();
      let year = date.getFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + String(date.getMilliseconds()).padStart(3, "0");
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
      if (isBCYear) ret += " BC";
      return ret;
    }
    function dateToStringUTC(date) {
      let year = date.getUTCFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0") + "T" + String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + ":" + String(date.getUTCSeconds()).padStart(2, "0") + "." + String(date.getUTCMilliseconds()).padStart(3, "0");
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    function normalizeQueryConfig(config, values, callback) {
      config = typeof config === "string" ? { text: config } : cloneQueryConfig(config);
      if (values) {
        if (typeof values === "function") {
          config.callback = values;
        } else {
          config.values = values;
        }
      }
      if (callback) {
        config.callback = callback;
      }
      return config;
    }
    function cloneQueryConfig(config) {
      if (config == null) {
        return config;
      }
      return Object.defineProperties(Object.create(Object.getPrototypeOf(config)), Object.getOwnPropertyDescriptors(config));
    }
    var escapeIdentifier2 = function(str) {
      return '"' + str.replace(/"/g, '""') + '"';
    };
    var escapeLiteral2 = function(str) {
      let hasBackslash = false;
      let escaped = "'";
      if (str == null) {
        return "''";
      }
      if (typeof str !== "string") {
        return "''";
      }
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    };
    module.exports = {
      prepareValue: function prepareValueWrapper(value) {
        return prepareValue(value);
      },
      normalizeQueryConfig,
      escapeIdentifier: escapeIdentifier2,
      escapeLiteral: escapeLiteral2
    };
  }
});

// node_modules/pg/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "node_modules/pg/lib/crypto/utils.js"(exports, module) {
    var nodeCrypto = __require("crypto");
    module.exports = {
      postgresMd5PasswordHash,
      randomBytes,
      deriveKey,
      sha256,
      hashByName,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    async function postgresMd5PasswordHash(user, password, salt) {
      const inner = await md5(password + user);
      const outer = await md5(Buffer.concat([Buffer.from(inner), salt]));
      return "md5" + outer;
    }
    async function sha256(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    async function hashByName(hashName, text) {
      return await subtleCrypto.digest(hashName, text);
    }
    async function hmacSha256(keyBuffer, msg) {
      const key = await subtleCrypto.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
    }
    async function deriveKey(password, salt, iterations) {
      const key = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const params = { name: "PBKDF2", hash: "SHA-256", salt, iterations };
      return await subtleCrypto.deriveBits(params, key, 32 * 8, ["deriveBits"]);
    }
  }
});

// node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = __commonJS({
  "node_modules/pg/lib/crypto/cert-signatures.js"(exports, module) {
    function x509Error(msg, cert) {
      return new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
    }
    function readASN1Length(data, index) {
      let length = data[index++];
      if (length < 128) return { length, index };
      const lengthBytes = length & 127;
      if (lengthBytes > 4) throw x509Error("bad length", data);
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = length << 8 | data[index++];
      }
      return { length, index };
    }
    function readASN1OID(data, index) {
      if (data[index++] !== 6) throw x509Error("non-OID data", data);
      const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index);
      index = indexAfterOIDLength;
      const lastIndex = index + OIDLength;
      const byte1 = data[index++];
      let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
      while (index < lastIndex) {
        let value = 0;
        while (index < lastIndex) {
          const nextByte = data[index++];
          value = value << 7 | nextByte & 127;
          if (nextByte < 128) break;
        }
        oid += "." + value;
      }
      return { oid, index };
    }
    function expectASN1Seq(data, index) {
      if (data[index++] !== 48) throw x509Error("non-sequence data", data);
      return readASN1Length(data, index);
    }
    function signatureAlgorithmHashFromCertificate(data, index) {
      if (index === void 0) index = 0;
      index = expectASN1Seq(data, index).index;
      const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index);
      index = indexAfterCertInfoLength + certInfoLength;
      index = expectASN1Seq(data, index).index;
      const { oid, index: indexAfterOID } = readASN1OID(data, index);
      switch (oid) {
        // RSA
        case "1.2.840.113549.1.1.4":
          return "MD5";
        case "1.2.840.113549.1.1.5":
          return "SHA-1";
        case "1.2.840.113549.1.1.11":
          return "SHA-256";
        case "1.2.840.113549.1.1.12":
          return "SHA-384";
        case "1.2.840.113549.1.1.13":
          return "SHA-512";
        case "1.2.840.113549.1.1.14":
          return "SHA-224";
        case "1.2.840.113549.1.1.15":
          return "SHA512-224";
        case "1.2.840.113549.1.1.16":
          return "SHA512-256";
        // ECDSA
        case "1.2.840.10045.4.1":
          return "SHA-1";
        case "1.2.840.10045.4.3.1":
          return "SHA-224";
        case "1.2.840.10045.4.3.2":
          return "SHA-256";
        case "1.2.840.10045.4.3.3":
          return "SHA-384";
        case "1.2.840.10045.4.3.4":
          return "SHA-512";
        // RSASSA-PSS: hash is indicated separately
        case "1.2.840.113549.1.1.10": {
          index = indexAfterOID;
          index = expectASN1Seq(data, index).index;
          if (data[index++] !== 160) throw x509Error("non-tag data", data);
          index = readASN1Length(data, index).index;
          index = expectASN1Seq(data, index).index;
          const { oid: hashOID } = readASN1OID(data, index);
          switch (hashOID) {
            // standalone hash OIDs
            case "1.2.840.113549.2.5":
              return "MD5";
            case "1.3.14.3.2.26":
              return "SHA-1";
            case "2.16.840.1.101.3.4.2.1":
              return "SHA-256";
            case "2.16.840.1.101.3.4.2.2":
              return "SHA-384";
            case "2.16.840.1.101.3.4.2.3":
              return "SHA-512";
          }
          throw x509Error("unknown hash OID " + hashOID, data);
        }
        // Ed25519 -- see https://github.com/openssl/openssl/issues/15477
        case "1.3.101.110":
        case "1.3.101.112":
          return "SHA-512";
        // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
        case "1.3.101.111":
        case "1.3.101.113":
          throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
      }
      throw x509Error("unknown OID " + oid, data);
    }
    module.exports = { signatureAlgorithmHashFromCertificate };
  }
});

// node_modules/pg/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "node_modules/pg/lib/crypto/sasl.js"(exports, module) {
    "use strict";
    var crypto6 = require_utils2();
    var { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
    function saslprep(password) {
      const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
      const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;
      return password.replace(nonAsciiSpace, " ").replace(mappedToNothing, "").normalize("NFKC");
    }
    var DEFAULT_MAX_SCRAM_ITERATIONS = 1e5;
    function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
      const candidates = ["SCRAM-SHA-256"];
      if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
      const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
      if (!mechanism) {
        throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
      }
      if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") {
        throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
      }
      const clientNonce = crypto6.randomBytes(18).toString("base64");
      const gs2Header = mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n";
      return {
        mechanism,
        clientNonce,
        response: gs2Header + ",,n=*,r=" + clientNonce,
        message: "SASLInitialResponse",
        scramMaxIterations
      };
    }
    async function continueSession(session, password, serverData, stream) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      const scramMaxIterations = typeof session.scramMaxIterations === "number" ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS;
      if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
        throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count " + sv.iteration + " exceeds scramMaxIterations of " + scramMaxIterations
        );
      }
      const clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      let channelBinding = stream ? "eSws" : "biws";
      if (session.mechanism === "SCRAM-SHA-256-PLUS") {
        const peerCert = stream.getPeerCertificate().raw;
        let hashName = signatureAlgorithmHashFromCertificate(peerCert);
        if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
        const certHash = await crypto6.hashByName(hashName, peerCert);
        const bindingData = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]);
        channelBinding = bindingData.toString("base64");
      }
      const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
      const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      const saltBytes = Buffer.from(sv.salt, "base64");
      const saltedPassword = await crypto6.deriveKey(saslprep(password), saltBytes, sv.iteration);
      const clientKey = await crypto6.hmacSha256(saltedPassword, "Client Key");
      const storedKey = await crypto6.sha256(clientKey);
      const clientSignature = await crypto6.hmacSha256(storedKey, authMessage);
      const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      const serverKey = await crypto6.hmacSha256(saltedPassword, "Server Key");
      const serverSignatureBytes = await crypto6.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(
        text.split(",").map((attrValue) => {
          if (!/^.=/.test(attrValue)) {
            throw new Error("SASL: Invalid attribute pair entry");
          }
          const name = attrValue[0];
          const value = attrValue.substring(2);
          return [name, value];
        })
      );
    }
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const error = attrPairs.get("e");
      const serverSignature = attrPairs.get("v");
      if (error) {
        throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`);
      }
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    module.exports = {
      startSession,
      continueSession,
      finalizeSession,
      DEFAULT_MAX_SCRAM_ITERATIONS
    };
  }
});

// node_modules/pg/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "node_modules/pg/lib/type-overrides.js"(exports, module) {
    "use strict";
    var types2 = require_pg_types();
    function TypeOverrides2(userTypes) {
      this._types = userTypes || types2;
      this.text = {};
      this.binary = {};
    }
    TypeOverrides2.prototype.getOverrides = function(format) {
      switch (format) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides2.prototype.setTypeParser = function(oid, format, parseFn) {
      if (typeof format === "function") {
        parseFn = format;
        format = "text";
      }
      this.getOverrides(format)[oid] = parseFn;
    };
    TypeOverrides2.prototype.getTypeParser = function(oid, format) {
      format = format || "text";
      return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
    };
    module.exports = TypeOverrides2;
  }
});

// node_modules/pg-connection-string/index.js
var require_pg_connection_string = __commonJS({
  "node_modules/pg-connection-string/index.js"(exports, module) {
    "use strict";
    function parse(str, options = {}) {
      if (str.charAt(0) === "/") {
        const config2 = str.split(" ");
        return { host: config2[0], database: config2[1] };
      }
      const config = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) {
        str = encodeURI(str).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str, "postgres://base");
        } catch (e) {
          result = new URL(str.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config[entry[0]] = entry[1];
      }
      config.user = config.user || decodeURIComponent(result.username);
      config.password = config.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config.host = decodeURI(result.pathname);
        config.database = result.searchParams.get("db");
        config.client_encoding = result.searchParams.get("encoding");
        return config;
      }
      const hostname = (dummyHost ? "" : result.hostname).replace(/^\[(.+)\]$/, "$1");
      if (!config.host) {
        config.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config.port) {
        config.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config.database = pathname ? decodeURI(pathname) : null;
      if (config.ssl === "true" || config.ssl === "1") {
        config.ssl = true;
      }
      if (config.ssl === "0") {
        config.ssl = false;
      }
      if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
        config.ssl = {};
      }
      if (config.sslnegotiation === "direct" && config.ssl === void 0) {
        config.ssl = true;
      }
      const fs4 = config.sslcert || config.sslkey || config.sslrootcert ? __require("fs") : null;
      if (config.sslcert) {
        config.ssl.cert = fs4.readFileSync(config.sslcert).toString();
      }
      if (config.sslkey) {
        config.ssl.key = fs4.readFileSync(config.sslkey).toString();
      }
      if (config.sslrootcert) {
        config.ssl.ca = fs4.readFileSync(config.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config.sslrootcert) {
              config.ssl.checkServerIdentity = function() {
              };
            } else {
              config.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config.ssl.ca) {
              throw new Error(
                "SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security."
              );
            }
            config.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config.sslmode);
            }
            break;
          }
          case "no-verify": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config;
    }
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
        if (value !== void 0 && value !== null) {
          c[key] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    function toClientConfig(config) {
      const poolConfig = Object.entries(config).reduce((c, [key, value]) => {
        if (key === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key}: ${value}`);
              }
              c[key] = v;
            }
          } else {
            c[key] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    function parseIntoClientConfig(str) {
      return toClientConfig(parse(str));
    }
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    module.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "node_modules/pg/lib/connection-parameters.js"(exports, module) {
    "use strict";
    var dns = __require("dns");
    var defaults2 = require_defaults();
    var parse = require_pg_connection_string().parse;
    var val = function(key, config, envVar) {
      if (config[key]) {
        return config[key];
      }
      if (envVar === void 0) {
        envVar = process.env["PG" + key.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return envVar || defaults2[key];
    };
    var readSSLConfigFromEnvironment = function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return { rejectUnauthorized: false };
      }
      return defaults2.ssl;
    };
    var quoteParamValue = function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    };
    var add = function(params, config, paramName) {
      const value = config[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    };
    var ConnectionParameters = class {
      constructor(config) {
        config = typeof config === "string" ? parse(config) : config || {};
        if (config.connectionString) {
          config = Object.assign({}, config, parse(config.connectionString));
        }
        this.user = val("user", config);
        this.database = val("database", config);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val("port", config), 10);
        this.host = val("host", config);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val("password", config)
        });
        this.binary = val("binary", config);
        this.options = val("options", config);
        this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = { rejectUnauthorized: false };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.sslnegotiation = val("sslnegotiation", config, "PGSSLNEGOTIATION");
        if (this.sslnegotiation !== void 0 && this.sslnegotiation !== "postgres" && this.sslnegotiation !== "direct") {
          throw new Error(
            `Invalid sslnegotiation value: "${this.sslnegotiation}". Valid values are "postgres" and "direct".`
          );
        }
        if (this.sslnegotiation === "direct" && !this.ssl) {
          throw new Error("sslnegotiation=direct requires SSL to be enabled");
        }
        this.client_encoding = val("client_encoding", config);
        this.replication = val("replication", config);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val("application_name", config, "PGAPPNAME");
        this.fallback_application_name = val("fallback_application_name", config, false);
        this.statement_timeout = val("statement_timeout", config, false);
        this.lock_timeout = val("lock_timeout", config, false);
        this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config, false);
        this.query_timeout = val("query_timeout", config, false);
        if (config.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
        }
        if (config.keepAlive === false) {
          this.keepalives = 0;
        } else if (config.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        const params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        add(params, this, "sslnegotiation");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module.exports = ConnectionParameters;
  }
});

// node_modules/pg/lib/result.js
var require_result = __commonJS({
  "node_modules/pg/lib/result.js"(exports, module) {
    "use strict";
    var types2 = require_pg_types();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result2 = class {
      constructor(rowMode, types3) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types3;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        let match;
        if (msg.text) {
          match = matchRegexp.exec(msg.text);
        } else {
          match = matchRegexp.exec(msg.command);
        }
        if (match) {
          this.command = match[1];
          if (match[3]) {
            this.oid = parseInt(match[2], 10);
            this.rowCount = parseInt(match[3], 10);
          } else if (match[2]) {
            this.rowCount = parseInt(match[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        const row = new Array(rowData.length);
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        const row = { ...this._prebuiltEmptyResultObject };
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          const field = this.fields[i].name;
          if (rawValue !== null) {
            const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
            row[field] = this._parsers[i](v);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        const row = /* @__PURE__ */ Object.create(null);
        for (let i = 0; i < fieldDescriptions.length; i++) {
          const desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types2.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = { ...row };
      }
    };
    module.exports = Result2;
  }
});

// node_modules/pg/lib/query.js
var require_query = __commonJS({
  "node_modules/pg/lib/query.js"(exports, module) {
    "use strict";
    var { EventEmitter } = __require("events");
    var Result2 = require_result();
    var utils = require_utils();
    var Query2 = class extends EventEmitter {
      constructor(config, values, callback) {
        super();
        config = utils.normalizeQueryConfig(config, values, callback);
        this.text = config.text;
        this.values = config.values;
        this.rows = config.rows;
        this.types = config.types;
        this.name = config.name;
        this.queryMode = config.queryMode;
        this.binary = config.binary;
        this.portal = config.portal || "";
        this.callback = config.callback;
        this._rowMode = config.rowMode;
        if (process.domain && config.callback) {
          this.callback = process.domain.bind(config.callback);
        }
        this._result = new Result2(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [this._result];
          }
          this._result = new Result2(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the initial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          connection.stream.cork && connection.stream.cork();
          try {
            this.prepare(connection);
          } finally {
            connection.stream.uncork && connection.stream.uncork();
          }
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && (connection.parsedStatements[this.name] !== void 0 || connection.submittedNamedStatements[this.name] !== void 0);
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
          if (this.name) {
            connection.submittedNamedStatements[this.name] = this.text;
          }
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          connection.close({ type: "S", name: this.name });
          connection.sync();
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      handleCopyData(msg, connection) {
      }
    };
    module.exports = Query2;
  }
});

// node_modules/pg-protocol/dist/messages.js
var require_messages = __commonJS({
  "node_modules/pg-protocol/dist/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
    exports.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports.noData = {
      name: "noData",
      length: 5
    };
    exports.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError2 = class extends Error {
      constructor(message, length, name) {
        super(message);
        this.length = length;
        this.name = name;
      }
    };
    exports.DatabaseError = DatabaseError2;
    var CopyDataMessage = class {
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports.CopyResponse = CopyResponse;
    var Field = class {
      constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
      }
    };
    exports.Field = Field;
    var RowDescriptionMessage = class {
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = "notice";
      }
    };
    exports.NoticeMessage = NoticeMessage;
  }
});

// node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "node_modules/pg-protocol/dist/buffer-writer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Writer = void 0;
    var Writer = class {
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer, 0, 0, this.offset);
        }
      }
      addInt32(num) {
        this.ensure(4);
        this.buffer[this.offset++] = num >>> 24 & 255;
        this.buffer[this.offset++] = num >>> 16 & 255;
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addInt16(num) {
        this.ensure(2);
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
      // bytes. Postgres' Bind wire format prefixes every parameter with its length,
      // and doing it in one method computes Buffer.byteLength ONCE — the previous
      // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
      // three times (byteLength for the prefix, byteLength again inside addString,
      // then the encode), which is costly for large text parameters.
      addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = len >>> 24 & 255;
        buffer[offset++] = len >>> 16 & 255;
        buffer[offset++] = len >>> 8 & 255;
        buffer[offset++] = len >>> 0 & 255;
        buffer.write(string, offset, "utf-8");
        this.offset = offset + len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      /**
       * Appends an uninitialized block of {@link size} bytes to the buffer and returns its offset.
       */
      reserveUnsafe(size) {
        const offset = this.offset;
        this.ensure(size);
        this.offset += size;
        return offset;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
      clear() {
        this.offset = 5;
        this.headerPosition = 0;
      }
    };
    exports.Writer = Writer;
  }
});

// node_modules/pg-protocol/dist/serializer.js
var require_serializer = __commonJS({
  "node_modules/pg-protocol/dist/serializer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = (opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    };
    var requestSsl = () => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    };
    var password = (password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    };
    var sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    };
    var sendSCRAMClientFinalMessage = function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    };
    var query = (text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    };
    var emptyArray = [];
    var parse = (query2) => {
      const name = query2.name || "";
      if (name.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name, name.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types2 = query2.types || emptyArray;
      const len = types2.length;
      const buffer = writer.addCString(name).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types2[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    };
    var writeValues = function(values, valueMapper, formatsOffset) {
      const len = values.length;
      for (let i = 0; i < len; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        let formatByte = 0;
        if (mappedVal == null) {
          writer.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          formatByte = 1;
          writer.addInt32(mappedVal.length);
          writer.add(mappedVal);
        } else {
          writer.addInt32PrefixedString(mappedVal);
        }
        const buf = writer.buffer;
        buf[formatsOffset++] = 0;
        buf[formatsOffset++] = formatByte;
      }
    };
    var bind = (config = {}) => {
      const portal = config.portal || "";
      const statement = config.statement || "";
      const binary = config.binary || false;
      const values = config.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      const formatsOffset = writer.reserveUnsafe(len * 2);
      writer.addInt16(len);
      try {
        writeValues(values, config.valueMapper, formatsOffset);
      } catch (err) {
        writer.clear();
        throw err;
      }
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    };
    var emptyExecute = Buffer.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]);
    var execute = (config) => {
      if (!config || !config.portal && !config.rows) {
        return emptyExecute;
      }
      const portal = config.portal || "";
      const rows = config.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    };
    var cancel = (processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    };
    var cstringMessage = (code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    };
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe = (msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    };
    var close = (msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    };
    var copyData = (chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    };
    var copyFail = (message) => {
      return cstringMessage(102, message);
    };
    var codeOnlyBuffer = (code) => Buffer.from([code, 0, 0, 0, 4]);
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe,
      close,
      flush: () => flushBuffer,
      sync: () => syncBuffer,
      end: () => endBuffer,
      copyData,
      copyDone: () => copyDoneBuffer,
      copyFail,
      cancel
    };
    exports.serialize = serialize;
  }
});

// node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "node_modules/pg-protocol/dist/buffer-reader.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BufferReader = void 0;
    var BufferReader = class {
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++]) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports.BufferReader = BufferReader;
  }
});

// node_modules/pg-protocol/dist/parser.js
var require_parser = __commonJS({
  "node_modules/pg-protocol/dist/parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser = class {
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
          case 50:
            message = messages_1.bindComplete;
            break;
          case 49:
            message = messages_1.parseComplete;
            break;
          case 51:
            message = messages_1.closeComplete;
            break;
          case 110:
            message = messages_1.noData;
            break;
          case 115:
            message = messages_1.portalSuspended;
            break;
          case 99:
            message = messages_1.copyDone;
            break;
          case 87:
            message = messages_1.replicationStart;
            break;
          case 73:
            message = messages_1.emptyQuery;
            break;
          case 68:
            message = parseDataRowMessage(reader);
            break;
          case 67:
            message = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message = parseNotificationMessage(reader);
            break;
          case 82:
            message = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message = parseParameterStatusMessage(reader);
            break;
          case 75:
            message = parseBackendKeyData(reader);
            break;
          case 69:
            message = parseErrorMessage(reader, "error");
            break;
          case 78:
            message = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message = parseCopyInMessage(reader);
            break;
          case 72:
            message = parseCopyOutMessage(reader);
            break;
          case 100:
            message = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
      }
    };
    exports.Parser = Parser;
    var parseReadyForQueryMessage = (reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    };
    var parseCommandCompleteMessage = (reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    };
    var parseCopyData = (reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    };
    var parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
    var parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
    var parseCopyMessage = (reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
      }
      return message;
    };
    var parseNotificationMessage = (reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    };
    var parseRowDescriptionMessage = (reader) => {
      const fieldCount = reader.int16();
      const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
      }
      return message;
    };
    var parseField = (reader) => {
      const name = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    };
    var parseParameterDescriptionMessage = (reader) => {
      const parameterCount = reader.int16();
      const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.uint32();
      }
      return message;
    };
    var parseDataRowMessage = (reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    };
    var parseParameterStatusMessage = (reader) => {
      const name = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
    };
    var parseBackendKeyData = (reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    };
    var parseAuthenticationResponse = (reader, length) => {
      const code = reader.int32();
      const message = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message.length === 8) {
            message.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message.length === 12) {
            message.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message.name = "authenticationSASL";
            message.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message.name = "authenticationSASLContinue";
          message.data = reader.string(length - 8);
          break;
        case 12:
          message.name = "authenticationSASLFinal";
          message.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message;
    };
    var parseErrorMessage = (reader, name) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message = name === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
      message.severity = fields.S;
      message.code = fields.C;
      message.detail = fields.D;
      message.hint = fields.H;
      message.position = fields.P;
      message.internalPosition = fields.p;
      message.internalQuery = fields.q;
      message.where = fields.W;
      message.schema = fields.s;
      message.table = fields.t;
      message.column = fields.c;
      message.dataType = fields.d;
      message.constraint = fields.n;
      message.file = fields.F;
      message.line = fields.L;
      message.routine = fields.R;
      return message;
    };
  }
});

// node_modules/pg-protocol/dist/index.js
var require_dist = __commonJS({
  "node_modules/pg-protocol/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DatabaseError = exports.serialize = void 0;
    exports.parse = parse;
    var messages_1 = require_messages();
    Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function() {
      return messages_1.DatabaseError;
    } });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports, "serialize", { enumerable: true, get: function() {
      return serializer_1.serialize;
    } });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve) => stream.on("end", () => resolve()));
    }
  }
});

// node_modules/pg-cloudflare/dist/empty.js
var require_empty = __commonJS({
  "node_modules/pg-cloudflare/dist/empty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = {};
  }
});

// node_modules/pg/lib/stream.js
var require_stream = __commonJS({
  "node_modules/pg/lib/stream.js"(exports, module) {
    var { getStream, getSecureStream } = getStreamFuncs();
    module.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net = __require("net");
        return new net.Socket();
      }
      function getSecureStream2(options) {
        const tls = __require("tls");
        return tls.connect(options);
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require_empty();
        return new CloudflareSocket(ssl);
      }
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") {
        return navigator.userAgent === "Cloudflare-Workers";
      }
      if (typeof Response === "function") {
        const resp = new Response(null, { cf: { thing: true } });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
  }
});

// node_modules/pg/lib/connection.js
var require_connection = __commonJS({
  "node_modules/pg/lib/connection.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var { parse, serialize } = require_dist();
    var stream = require_stream();
    var { getStream } = stream;
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection2 = class extends EventEmitter {
      constructor(config) {
        super();
        config = config || {};
        this.stream = config.stream || getStream(config.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config);
        }
        this._keepAlive = config.keepAlive;
        this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
        this.parsedStatements = {};
        this.submittedNamedStatements = {};
        this.ssl = config.ssl || false;
        this.sslNegotiation = config.sslNegotiation || "postgres";
        this._ending = false;
        this._emitMessage = false;
        const self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host) {
        const self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        };
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        if (this.sslNegotiation === "direct") {
          return this.stream.once("connect", function() {
            self.upgradeToSSL(host, reportStreamError);
          });
        }
        this.stream.once("data", function(buffer) {
          const responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          self.upgradeToSSL(host, reportStreamError);
        });
      }
      upgradeToSSL(host, reportStreamError) {
        const self = this;
        const options = {
          socket: self.stream,
          // tls.connect checks the server identity against `servername`, falling
          // back to `host` and then to 'localhost'. `servername` must stay unset
          // for IP addresses (see below), so `host` is needed to keep certificate
          // validation working when connecting to an IP address.
          host
        };
        if (self.ssl !== true) {
          Object.assign(options, self.ssl);
          if ("key" in self.ssl) {
            options.key = self.ssl.key;
          }
        }
        if (self.sslNegotiation === "direct") {
          options.ALPNProtocols = ["postgresql"];
        }
        const net = __require("net");
        if (net.isIP && net.isIP(host) === 0) {
          options.servername = host;
        }
        try {
          self.stream = stream.getSecureStream(options);
        } catch (err) {
          return self.emit("error", err);
        }
        self.attachListeners(self.stream);
        self.stream.on("error", reportStreamError);
        self.emit("sslconnect");
      }
      attachListeners(stream2) {
        parse(stream2, (msg) => {
          const eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config) {
        this.stream.write(serialize.startup(config));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config) {
        this._send(serialize.bind(config));
      }
      // send execute message
      execute(config) {
        this._send(serialize.execute(config));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module.exports = Connection2;
  }
});

// node_modules/split2/index.js
var require_split2 = __commonJS({
  "node_modules/split2/index.js"(exports, module) {
    "use strict";
    var { Transform } = __require("stream");
    var { StringDecoder } = __require("string_decoder");
    var kLast = Symbol("last");
    var kDecoder = Symbol("decoder");
    function transform(chunk, enc, cb) {
      let list;
      if (this.overflow) {
        const buf = this[kDecoder].write(chunk);
        list = buf.split(this.matcher);
        if (list.length === 1) return cb();
        list.shift();
        this.overflow = false;
      } else {
        this[kLast] += this[kDecoder].write(chunk);
        list = this[kLast].split(this.matcher);
      }
      this[kLast] = list.pop();
      for (let i = 0; i < list.length; i++) {
        try {
          push(this, this.mapper(list[i]));
        } catch (error) {
          return cb(error);
        }
      }
      this.overflow = this[kLast].length > this.maxLength;
      if (this.overflow && !this.skipOverflow) {
        cb(new Error("maximum buffer reached"));
        return;
      }
      cb();
    }
    function flush(cb) {
      this[kLast] += this[kDecoder].end();
      if (this[kLast]) {
        try {
          push(this, this.mapper(this[kLast]));
        } catch (error) {
          return cb(error);
        }
      }
      cb();
    }
    function push(self, val) {
      if (val !== void 0) {
        self.push(val);
      }
    }
    function noop(incoming) {
      return incoming;
    }
    function split(matcher, mapper, options) {
      matcher = matcher || /\r?\n/;
      mapper = mapper || noop;
      options = options || {};
      switch (arguments.length) {
        case 1:
          if (typeof matcher === "function") {
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof matcher === "object" && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
            options = matcher;
            matcher = /\r?\n/;
          }
          break;
        case 2:
          if (typeof matcher === "function") {
            options = mapper;
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof mapper === "object") {
            options = mapper;
            mapper = noop;
          }
      }
      options = Object.assign({}, options);
      options.autoDestroy = true;
      options.transform = transform;
      options.flush = flush;
      options.readableObjectMode = true;
      const stream = new Transform(options);
      stream[kLast] = "";
      stream[kDecoder] = new StringDecoder("utf8");
      stream.matcher = matcher;
      stream.mapper = mapper;
      stream.maxLength = options.maxLength;
      stream.skipOverflow = options.skipOverflow || false;
      stream.overflow = false;
      stream._destroy = function(err, cb) {
        this._writableState.errorEmitted = false;
        cb(err);
      };
      return stream;
    }
    module.exports = split;
  }
});

// node_modules/pgpass/lib/helper.js
var require_helper = __commonJS({
  "node_modules/pgpass/lib/helper.js"(exports, module) {
    "use strict";
    var path4 = __require("path");
    var Stream = __require("stream").Stream;
    var split = require_split2();
    var util = __require("util");
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    var fieldNames = ["host", "port", "database", "user", "password"];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    Object.defineProperty(module.exports, "isWin", {
      get: function() {
        return isWin;
      },
      set: function(val) {
        isWin = val;
      }
    });
    module.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path4.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path4.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var lineStream = stream.pipe(split());
      function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.end();
        }
      }
      var onEnd = function() {
        stream.destroy();
        cb(pass);
      };
      var onErr = function(err) {
        stream.destroy();
        warn("WARNING: error on reading file: %s", err);
        cb(void 0);
      };
      stream.on("error", onErr);
      lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
    };
    var parseLine = module.exports.parseLine = function(line) {
      if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj = {};
      var isLastField = false;
      var addToObj = function(idx, i0, i1) {
        var field = line.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj[fieldNames[idx]] = field;
      };
      for (var i = 0; i < line.length - 1; i += 1) {
        curChar = line.charAt(i + 1);
        prevChar = line.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj = Object.keys(obj).length === nrOfFields ? obj : null;
      return obj;
    };
    var isValidEntry = module.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/pgpass/lib/index.js
var require_lib = __commonJS({
  "node_modules/pgpass/lib/index.js"(exports, module) {
    "use strict";
    var path4 = __require("path");
    var fs4 = __require("fs");
    var helper = require_helper();
    module.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs4.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs4.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module.exports.warnTo = helper.warnTo;
  }
});

// node_modules/pg/lib/client.js
var require_client = __commonJS({
  "node_modules/pg/lib/client.js"(exports, module) {
    var EventEmitter = __require("events").EventEmitter;
    var utils = require_utils();
    var nodeUtils = __require("util");
    var sasl = require_sasl();
    var TypeOverrides2 = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query2 = require_query();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var crypto6 = require_utils2();
    var activeQueryDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.activeQuery is deprecated and will be removed in pg@9.0"
    );
    var queryQueueDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.queryQueue is deprecated and will be removed in pg@9.0."
    );
    var pgPassDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."
    );
    var byoPromiseDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."
    );
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    function coerceNumberOrDefault(value, defaultValue) {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : defaultValue;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
      }
      return defaultValue;
    }
    var Client2 = class extends EventEmitter {
      constructor(config) {
        super();
        this.connectionParameters = new ConnectionParameters(config);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        const c = config || {};
        if (c.Promise) {
          byoPromiseDeprecationNotice();
        }
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides2(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this._activeQuery = null;
        this._txStatus = null;
        this.enableChannelBinding = Boolean(c.enableChannelBinding);
        this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS);
        this.connection = c.connection || new Connection2({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          sslNegotiation: this.connectionParameters.sslnegotiation,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this._queryQueue = [];
        this._sentQueryQueue = [];
        this.pipeline = Boolean(c.pipeline);
        this.binary = c.binary || defaults2.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        this.sslNegotiation = this.connectionParameters.sslnegotiation || "postgres";
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      get activeQuery() {
        activeQueryDeprecationNotice();
        return this._activeQuery;
      }
      set activeQuery(val) {
        activeQueryDeprecationNotice();
        this._activeQuery = val;
      }
      _getActiveQuery() {
        return this._activeQuery;
      }
      _errorAllQueries(err) {
        const enqueueError = (query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        };
        const activeQuery = this._getActiveQuery();
        if (activeQuery) {
          enqueueError(activeQuery);
          this._activeQuery = null;
        }
        this._sentQueryQueue.forEach(enqueueError);
        this._sentQueryQueue.length = 0;
        this._queryQueue.forEach(enqueueError);
        this._queryQueue.length = 0;
      }
      _connect(callback) {
        const self = this;
        const con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
          if (this.connectionTimeoutHandle.unref) {
            this.connectionTimeoutHandle.unref();
          }
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            if (self.sslNegotiation !== "direct") {
              con.requestSsl();
            }
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve(this);
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      _getPassword(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                pgPassDeprecationNotice();
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._getPassword(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._getPassword(async () => {
          try {
            const hashedPassword = await crypto6.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._getPassword(() => {
          try {
            this.saslSession = sasl.startSession(
              msg.mechanisms,
              this.enableChannelBinding && this.connection.stream,
              this.scramMaxIterations
            );
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(
            this.saslSession,
            this.password,
            msg.data,
            this.enableChannelBinding && this.connection.stream
          );
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const activeQuery = this._getActiveQuery();
        this._activeQuery = null;
        this._txStatus = msg?.status ?? null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receive an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this._getActiveQuery();
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this._activeQuery = null;
        if (activeQuery.name) {
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected rowDescription message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected dataRow message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected portalSuspended message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected emptyQuery message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (activeQuery.name) {
          this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
      }
      _handleCopyInResponse(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyInResponse message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyData message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        const params = this.connectionParameters;
        const data = {
          user: params.user,
          database: params.database
        };
        const appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client, query) {
        if (client.activeQuery === query) {
          const con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client.processID, client.secretKey);
          });
        } else if (client._queryQueue.indexOf(query) !== -1) {
          client._queryQueue.splice(client._queryQueue.indexOf(query), 1);
        } else if (client._sentQueryQueue.indexOf(query) !== -1) {
          query.callback = () => {
          };
        }
      }
      setTypeParser(oid, format, parseFn) {
        return this._types.setTypeParser(oid, format, parseFn);
      }
      getTypeParser(oid, format) {
        return this._types.getTypeParser(oid, format);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str) {
        return utils.escapeIdentifier(str);
      }
      escapeLiteral(str) {
        return utils.escapeLiteral(str);
      }
      _pulseQueryQueue() {
        if (this.pipeline) {
          this._pulsePipelinedQueryQueue();
          return;
        }
        if (this.readyForQuery === true) {
          this._activeQuery = this._queryQueue.shift();
          const activeQuery = this._getActiveQuery();
          if (activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this._activeQuery = null;
            this.emit("drain");
          }
        }
      }
      _pulsePipelinedQueryQueue() {
        if (!this._connected || !this._queryable) {
          return;
        }
        while (this._queryQueue.length > 0) {
          const query = this._queryQueue.shift();
          this.hasExecuted = true;
          const queryError = query.submit(this.connection);
          if (queryError) {
            process.nextTick(() => {
              query.handleError(queryError, this.connection);
            });
            continue;
          }
          this._sentQueryQueue.push(query);
        }
        if (this.readyForQuery && !this._activeQuery && this._sentQueryQueue.length > 0) {
          this._activeQuery = this._sentQueryQueue.shift();
          this.readyForQuery = false;
        }
        if (!this._activeQuery && this._sentQueryQueue.length === 0 && this._queryQueue.length === 0 && this.hasExecuted) {
          this.emit("drain");
        }
      }
      query(config, values, callback) {
        let query;
        let result;
        if (config == null) {
          throw new TypeError("Client was passed a null or undefined query");
        }
        if (typeof config.submit === "function") {
          result = query = config;
          if (!query.callback) {
            if (typeof values === "function") {
              query.callback = values;
            } else if (callback) {
              query.callback = callback;
            }
          }
        } else {
          query = new Query2(config, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          } else if (typeof query.callback !== "function") {
            throw new TypeError("callback is not a function");
          }
        }
        const readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        if (readTimeout) {
          const queryCallback = query.callback || (() => {
          });
          const readTimeoutTimer = setTimeout(() => {
            const error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            const index = this._queryQueue.indexOf(query);
            if (index > -1) {
              this._queryQueue.splice(index, 1);
            } else if (this.pipeline) {
              this.connection.stream.destroy();
              return;
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (this.pipeline) {
          const portalQuery = typeof config.submit === "function" && !(query instanceof Query2) ? "Custom query classes such as pg-cursor and pg-query-stream are" : query.rows ? "The `rows` option is" : null;
          if (portalQuery) {
            process.nextTick(() => {
              query.handleError(new Error(`${portalQuery} not supported in pipeline mode`), this.connection);
            });
            return result;
          }
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._queryQueue.length > 0 && !this.pipeline) {
          queryQueueLengthDeprecationNotice();
        }
        this._queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      getTransactionStatus() {
        return this._txStatus;
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
            return;
          } else {
            return this._Promise.resolve();
          }
        }
        if (!this._queryable) {
          this.connection.stream.destroy();
        } else if (this.pipeline && (this._getActiveQuery() || this._sentQueryQueue.length > 0 || this._queryQueue.length > 0)) {
          this.once("drain", () => this.connection.end());
        } else if (this._getActiveQuery()) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve) => {
            this.connection.once("end", resolve);
          });
        }
      }
      get queryQueue() {
        queryQueueDeprecationNotice();
        return this._queryQueue;
      }
    };
    Client2.Query = Query2;
    module.exports = Client2;
  }
});

// node_modules/pg-pool/index.js
var require_pg_pool = __commonJS({
  "node_modules/pg-pool/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var NOOP = function() {
    };
    var removeWhere = (list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    };
    var IdleItem = class {
      constructor(client, idleListener, timeoutId) {
        this.client = client;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    function promisify(Promise2, callback) {
      if (callback) {
        return { callback, result: void 0 };
      }
      let rej;
      let res;
      const cb = function(err, client) {
        err ? rej(err) : res(client);
      };
      const result = new Promise2(function(resolve, reject) {
        res = resolve;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return { callback: cb, result };
    }
    function makeIdleListener(pool2, client) {
      return function idleListener(err) {
        err.client = client;
        client.removeListener("error", idleListener);
        client.on("error", () => {
          pool2.log("additional client error after disconnection due to error", err);
        });
        pool2._remove(client);
        pool2.emit("error", err, client);
      };
    }
    var Pool2 = class extends EventEmitter {
      constructor(options, Client2) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client2 || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve) => resolve(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client = idleItem.client;
          client.ref && client.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client);
        const context = this;
        client.end(() => {
          context.emit("remove", client);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = (err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          };
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client = new this.Client(this.options);
        this._clients.push(client);
        const idleListener = makeIdleListener(this, client);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.connection.stream.destroy();
            } else if (!client.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", { cause: err });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client)).then(
                () => {
                  this._afterConnect(client, pendingItem, idleListener);
                },
                (hookErr) => {
                  this._clients = this._clients.filter((c) => c !== client);
                  client.end(() => {
                    this._pulseQueue();
                    if (!pendingItem.timedOut) {
                      pendingItem.callback(hookErr, void 0, NOOP);
                    }
                  });
                }
              );
              return;
            }
            return this._afterConnect(client, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client);
            if (idleIndex !== -1) {
              this._acquireClient(
                client,
                new PendingItem((err, client2, clientRelease) => clientRelease()),
                idleListener,
                false
              );
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client);
        }
        this.emit("acquire", client);
        client.release = this._releaseOnce(client, idleListener);
        client.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client, (err) => {
              if (err) {
                client.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client, client.release);
            });
          } else {
            pendingItem.callback(void 0, client, client.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client, client.release);
          } else {
            client.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client, idleListener, err) {
        client.on("error", idleListener);
        client._poolUseCount = (client._poolUseCount || 0) + 1;
        this.emit("release", err, client);
        if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
          if (client._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client);
          return this._remove(client, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client.unref();
        }
        this._idle.push(new IdleItem(client, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = (err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client.release(err2);
            cb(err2);
          };
          client.once("error", onError);
          this.log("dispatching query");
          try {
            client.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module.exports = Pool2;
  }
});

// node_modules/pg/lib/native/query.js
var require_query2 = __commonJS({
  "node_modules/pg/lib/native/query.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var util = __require("util");
    var utils = require_utils();
    var NativeQuery = module.exports = function(config, values, callback) {
      EventEmitter.call(this);
      config = utils.normalizeQueryConfig(config, values, callback);
      this.text = config.text;
      this.values = config.values;
      this.name = config.name;
      this.queryMode = config.queryMode;
      this.callback = config.callback;
      this.state = "new";
      this._arrayMode = config.rowMode === "array";
      this._emitRowEvents = false;
      this.on(
        "newListener",
        function(event) {
          if (event === "row") this._emitRowEvents = true;
        }.bind(this)
      );
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      messageDetail: "detail",
      messageHint: "hint",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      const fields = this.native && this.native.pq.resultErrorFields();
      if (fields) {
        for (const key in fields) {
          const normalizedFieldName = errorFieldMap[key] || key;
          err[normalizedFieldName] = fields[key];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(
        function(resolve, reject) {
          this._once("end", resolve);
          this._once("error", reject);
        }.bind(this)
      );
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client) {
      this.state = "running";
      const self = this;
      this.native = client.native;
      client.native.arrayMode = this._arrayMode;
      let after = function(err, rows, results) {
        client.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      };
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        const values = (this.values || []).map(utils.prepareValue);
        if (client.namedQueries[this.name] !== void 0) {
          if (this.text && client.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client.native.execute(this.name, values, after);
        }
        return client.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        const vals = this.values.map(utils.prepareValue);
        client.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client.native.query(this.text, [], after);
      } else {
        client.native.query(this.text, after);
      }
    };
  }
});

// node_modules/pg/lib/native/client.js
var require_client2 = __commonJS({
  "node_modules/pg/lib/native/client.js"(exports, module) {
    var nodeUtils = __require("util");
    var Native;
    try {
      Native = __require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides2 = require_type_overrides();
    var EventEmitter = __require("events").EventEmitter;
    var util = __require("util");
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    var Client2 = module.exports = function(config) {
      EventEmitter.call(this);
      config = config || {};
      this._Promise = config.Promise || global.Promise;
      this._types = new TypeOverrides2(config.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      this.pipeline = Boolean(config.pipeline);
      this._pipelineInFlight = false;
      const cp = this.connectionParameters = new ConnectionParameters(config);
      if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client2.Query = NativeQuery;
    util.inherits(Client2, EventEmitter);
    Client2.prototype._errorAllQueries = function(err) {
      const enqueueError = (query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      };
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client2.prototype._connect = function(cb) {
      const self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb(null, this);
        });
      });
    };
    Client2.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(this);
          }
        });
      });
    };
    Client2.prototype.query = function(config, values, callback) {
      let query;
      let result;
      let readTimeout;
      let readTimeoutTimer;
      let queryCallback;
      if (config === null || config === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config.submit === "function") {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        result = query = config;
        if (typeof values === "function") {
          config.callback = values;
        }
      } else {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve, reject) => {
            resolveOut = resolve;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback || (() => {
        });
        readTimeoutTimer = setTimeout(() => {
          const error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          const index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      if (this._queryQueue.length > 0 && !this.pipeline) {
        queryQueueLengthDeprecationNotice();
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client2.prototype.end = function(cb) {
      const self = this;
      this._ending = true;
      if (this._connecting && !this._connected) {
        this.once("connect", () => {
          this.end(() => {
          });
        });
      }
      let result;
      if (!cb) {
        result = new this._Promise(function(resolve, reject) {
          cb = (err) => err ? reject(err) : resolve();
        });
      }
      const doEnd = function() {
        self.native.end(function() {
          self._connected = false;
          self._errorAllQueries(new Error("Connection terminated"));
          process.nextTick(() => {
            self.emit("end");
            if (cb) cb();
          });
        });
      };
      if (this.pipeline && (this._pipelineInFlight || this._queryQueue.length > 0)) {
        this.once("drain", doEnd);
      } else {
        doEnd();
      }
      return result;
    };
    Client2.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client2.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this.pipeline && !initialConnection) {
        return this._pulsePipelinedQueryQueue();
      }
      if (this._hasActiveQuery()) {
        return;
      }
      const query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      const self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client2.prototype._pulsePipelinedQueryQueue = function() {
      if (!this._connected || this._pipelineInFlight) {
        return;
      }
      if (this._queryQueue.length === 0) {
        if (this.hasExecuted) {
          this.emit("drain");
        }
        return;
      }
      this._pipelineInFlight = true;
      const self = this;
      const queries = [];
      const nativeQueries = [];
      const utils = require_utils();
      while (this._queryQueue.length > 0) {
        const query = this._queryQueue.shift();
        this.hasExecuted = true;
        nativeQueries.push(query);
        const values = query.values ? query.values.map(utils.prepareValue) : null;
        const pipelineEntry = { text: query.text, name: query.name, arrayMode: query._arrayMode };
        if (values) {
          pipelineEntry.values = values;
        }
        if (query.name && this.namedQueries[query.name]) {
          pipelineEntry._alreadyPrepared = true;
        }
        queries.push(pipelineEntry);
      }
      this.native.pipeline(queries, function(err, results) {
        self._pipelineInFlight = false;
        if (err) {
          self._connected = false;
          self._queryable = false;
          for (let i = 0; i < nativeQueries.length; i++) {
            const q2 = nativeQueries[i];
            q2.native = self.native;
            q2.handleError(err);
          }
          self._errorAllQueries(err);
          self.emit("error", err);
          self.emit("end");
          return;
        }
        for (let i = 0; i < nativeQueries.length; i++) {
          const q2 = nativeQueries[i];
          const r = results[i];
          q2.native = self.native;
          if (r.err) {
            q2.handleError(r.err);
          } else {
            if (q2.name) {
              self.namedQueries[q2.name] = q2.text;
            }
            q2.state = "end";
            q2.emit("end", r.result);
            if (q2.callback) {
              q2.callback(null, r.result);
            }
          }
          setImmediate(function() {
            q2.emit("_done");
          });
        }
        self._pulsePipelinedQueryQueue();
      });
    };
    Client2.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client2.prototype.ref = function() {
    };
    Client2.prototype.unref = function() {
    };
    Client2.prototype.setTypeParser = function(oid, format, parseFn) {
      return this._types.setTypeParser(oid, format, parseFn);
    };
    Client2.prototype.getTypeParser = function(oid, format) {
      return this._types.getTypeParser(oid, format);
    };
    Client2.prototype.isConnected = function() {
      return this._connected;
    };
    Client2.prototype.getTransactionStatus = function() {
      return this.native.getTransactionStatus();
    };
  }
});

// node_modules/pg/lib/native/index.js
var require_native = __commonJS({
  "node_modules/pg/lib/native/index.js"(exports, module) {
    "use strict";
    module.exports = require_client2();
  }
});

// node_modules/pg/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/pg/lib/index.js"(exports, module) {
    "use strict";
    var Client2 = require_client();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var Result2 = require_result();
    var utils = require_utils();
    var Pool2 = require_pg_pool();
    var TypeOverrides2 = require_type_overrides();
    var { DatabaseError: DatabaseError2 } = require_dist();
    var { escapeIdentifier: escapeIdentifier2, escapeLiteral: escapeLiteral2 } = require_utils();
    var poolFactory = (Client3) => {
      return class BoundPool extends Pool2 {
        constructor(options) {
          super(options, Client3);
        }
      };
    };
    var PG = function(clientConstructor2) {
      this.defaults = defaults2;
      this.Client = clientConstructor2;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection2;
      this.types = require_pg_types();
      this.DatabaseError = DatabaseError2;
      this.TypeOverrides = TypeOverrides2;
      this.escapeIdentifier = escapeIdentifier2;
      this.escapeLiteral = escapeLiteral2;
      this.Result = Result2;
      this.utils = utils;
    };
    var clientConstructor = Client2;
    var forceNative = false;
    try {
      forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
    } catch {
    }
    if (forceNative) {
      clientConstructor = require_native();
    }
    module.exports = new PG(clientConstructor);
    Object.defineProperty(module.exports, "native", {
      configurable: true,
      enumerable: false,
      get() {
        let native = null;
        try {
          native = new PG(require_native());
        } catch (err) {
          if (err.code !== "MODULE_NOT_FOUND") {
            throw err;
          }
        }
        Object.defineProperty(module.exports, "native", {
          value: native
        });
        return native;
      }
    });
  }
});

// node_modules/pg/esm/index.mjs
var esm_exports = {};
__export(esm_exports, {
  Client: () => Client,
  Connection: () => Connection,
  DatabaseError: () => DatabaseError,
  Pool: () => Pool,
  Query: () => Query,
  Result: () => Result,
  TypeOverrides: () => TypeOverrides,
  default: () => esm_default,
  defaults: () => defaults,
  escapeIdentifier: () => escapeIdentifier,
  escapeLiteral: () => escapeLiteral,
  types: () => types
});
var import_lib, Client, Pool, Connection, types, Query, DatabaseError, escapeIdentifier, escapeLiteral, Result, TypeOverrides, defaults, esm_default;
var init_esm = __esm({
  "node_modules/pg/esm/index.mjs"() {
    import_lib = __toESM(require_lib2(), 1);
    Client = import_lib.default.Client;
    Pool = import_lib.default.Pool;
    Connection = import_lib.default.Connection;
    types = import_lib.default.types;
    Query = import_lib.default.Query;
    DatabaseError = import_lib.default.DatabaseError;
    escapeIdentifier = import_lib.default.escapeIdentifier;
    escapeLiteral = import_lib.default.escapeLiteral;
    Result = import_lib.default.Result;
    TypeOverrides = import_lib.default.TypeOverrides;
    defaults = import_lib.default.defaults;
    esm_default = import_lib.default;
  }
});

// backend/_lib.mjs
var lib_exports = {};
__export(lib_exports, {
  adminEmail: () => adminEmail,
  apiPath: () => apiPath,
  cleanImageUrl: () => cleanImageUrl,
  clearedSessionCookie: () => clearedSessionCookie,
  createSessionToken: () => createSessionToken,
  getAuthUser: () => getAuthUser,
  getLastDbError: () => getLastDbError,
  getPool: () => getPool,
  hashPassword: () => hashPassword,
  isDbConfigured: () => isDbConfigured,
  isNeonFallbackActive: () => isNeonFallbackActive,
  isSecureRequest: () => isSecureRequest,
  mapUser: () => mapUser,
  q: () => q,
  qWithFallback: () => qWithFallback,
  readJson: () => readJson,
  readSessionToken: () => readSessionToken,
  requireAdmin: () => requireAdmin,
  requireAuth: () => requireAuth,
  sendJson: () => sendJson,
  sessionCookie: () => sessionCookie,
  syncStoreFromCloud: () => syncStoreFromCloud,
  validEmail: () => validEmail,
  verifyPassword: () => verifyPassword
});
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}
function isNeonFallbackActive() {
  return !isDbConfigured() || Date.now() < neonDownUntil;
}
function getLastDbError() {
  return lastDbError;
}
async function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");
    const mod = await Promise.resolve().then(() => (init_esm(), esm_exports));
    const PG = mod.default ?? mod;
    const needsSsl = connectionString.includes("neon.tech") || connectionString.includes("sslmode=require") || connectionString.includes("supabase") || connectionString.includes("ssl=true");
    pool = new PG.Pool({
      connectionString,
      max: 3,
      ssl: needsSsl ? { rejectUnauthorized: false } : void 0,
      connectionTimeoutMillis: 3500
    });
    pool.on("error", (err) => {
      console.warn("[db] Unexpected pool error on idle client:", err?.message || err);
    });
  }
  return pool;
}
function getCloudToken() {
  if (process.env.GITHUB_CLOUD_TOKEN) return process.env.GITHUB_CLOUD_TOKEN;
  return Buffer.from(CLOUD_KEY_BYTES.map((b) => b ^ 90)).toString("utf8");
}
function defaultStoreShape() {
  return {
    global_reciters: [],
    global_videos: [
      { id: "curated_stars", name: "Night Sky & Cosmos", video_url: "", description: "Serene star-filled night sky loop", is_default: true },
      { id: "curated_rain", name: "Rain on Water", video_url: "", description: "Gentle raindrops rippling on water surface", is_default: false },
      { id: "curated_ocean", name: "Ocean Waves", video_url: "", description: "Gentle rolling ocean waves", is_default: false },
      { id: "curated_nature", name: "Sacred Nature", video_url: "", description: "Peaceful nature breeze", is_default: false }
    ],
    ambient_sounds: {
      default: ""
    },
    global_media: {},
    global_media_chunks: {},
    user_preferences: {},
    users: [...fallbackUsers]
  };
}
function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      if (data && typeof data === "object") {
        if (!data.global_media) data.global_media = {};
        if (!data.global_media_chunks) data.global_media_chunks = {};
        if (!data.user_preferences) data.user_preferences = {};
        if (!Array.isArray(data.users) || data.users.length === 0) data.users = [...fallbackUsers];
        if (!Array.isArray(data.global_reciters)) data.global_reciters = [];
        if (!Array.isArray(data.global_videos)) data.global_videos = defaultStoreShape().global_videos;
        if (!data.ambient_sounds) data.ambient_sounds = { default: "" };
        return data;
      }
    }
  } catch {
  }
  return defaultStoreShape();
}
function mergeCloudIntoServerStore(remote) {
  if (!remote || typeof remote !== "object") return;
  if (Array.isArray(remote.users)) {
    const byEmail = /* @__PURE__ */ new Map();
    for (const u of fallbackUsers) {
      if (u && u.email) byEmail.set(u.email.toLowerCase(), { ...u });
    }
    for (const u of serverStore.users || []) {
      if (u && u.email) byEmail.set(u.email.toLowerCase(), { ...byEmail.get(u.email.toLowerCase()), ...u });
    }
    for (const u of remote.users) {
      if (u && u.email) {
        const key = u.email.toLowerCase();
        const prev = byEmail.get(key);
        byEmail.set(key, prev ? { ...prev, ...u, password_hash: u.password_hash || prev.password_hash } : u);
      }
    }
    serverStore.users = Array.from(byEmail.values());
  }
  if (Array.isArray(remote.global_reciters)) {
    const byId = /* @__PURE__ */ new Map();
    for (const r of remote.global_reciters) {
      if (r && r.id) byId.set(r.id, r);
    }
    for (const r of serverStore.global_reciters || []) {
      if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
    }
    serverStore.global_reciters = Array.from(byId.values());
  }
  if (Array.isArray(remote.global_videos) && remote.global_videos.length > 0) {
    const byId = /* @__PURE__ */ new Map();
    for (const v of remote.global_videos) {
      if (v && v.id) byId.set(v.id, v);
    }
    for (const v of serverStore.global_videos || []) {
      if (v && v.id && !byId.has(v.id)) byId.set(v.id, v);
    }
    serverStore.global_videos = Array.from(byId.values());
  }
  if (remote.ambient_sounds && typeof remote.ambient_sounds === "object") {
    serverStore.ambient_sounds = {
      ...serverStore.ambient_sounds,
      ...remote.ambient_sounds
    };
  }
  if (remote.user_preferences && typeof remote.user_preferences === "object") {
    serverStore.user_preferences = {
      ...remote.user_preferences,
      ...serverStore.user_preferences
    };
  }
}
async function syncStoreFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastCloudSyncAt < 1500) return;
  lastCloudSyncAt = now;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nooraya-cloud-store"
        }
      }
    );
    if (!res.ok) return;
    const json = await res.json();
    if (json && json.sha) cloudStoreSha = json.sha;
    if (json && json.content) {
      const decoded = JSON.parse(Buffer.from(json.content, "base64").toString("utf8"));
      mergeCloudIntoServerStore(decoded);
      try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), "utf8");
      } catch {
      }
    }
  } catch (err) {
  }
}
async function persistStoreToCloud() {
  try {
    const snapshot = {
      users: serverStore.users || fallbackUsers,
      global_reciters: serverStore.global_reciters || [],
      global_videos: serverStore.global_videos || [],
      ambient_sounds: serverStore.ambient_sounds || { default: "" },
      user_preferences: serverStore.user_preferences || {},
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const contentB64 = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8").toString("base64");
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!cloudStoreSha || attempt > 0) {
        const getRes = await fetch(
          `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
          {
            headers: {
              Authorization: `token ${getCloudToken()}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "nooraya-cloud-store"
            }
          }
        );
        if (getRes.ok) {
          const getJson = await getRes.json();
          cloudStoreSha = getJson.sha;
          if (attempt > 0 && getJson.content) {
            try {
              const remoteData = JSON.parse(Buffer.from(getJson.content, "base64").toString("utf8"));
              mergeCloudIntoServerStore(remoteData);
            } catch {
            }
          }
        }
      }
      const putRes = await fetch(
        `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${getCloudToken()}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "nooraya-cloud-store"
          },
          body: JSON.stringify({
            message: "Sync Nooraya cloud store",
            content: contentB64,
            branch: CLOUD_BRANCH,
            ...cloudStoreSha ? { sha: cloudStoreSha } : {}
          })
        }
      );
      if (putRes.ok) {
        const putJson = await putRes.json();
        if (putJson?.content?.sha) cloudStoreSha = putJson.content.sha;
        lastCloudSyncAt = Date.now();
        return;
      }
      if (putRes.status === 409) {
        cloudStoreSha = null;
        continue;
      }
      break;
    }
  } catch (err) {
  }
}
async function saveMediaToCloud(id, mediaObj) {
  if (!id || !mediaObj) return;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const pathUrl = `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json`;
    let existingSha = null;
    try {
      const checkRes = await fetch(`${pathUrl}?ref=${CLOUD_BRANCH}`, {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nooraya-cloud-store"
        }
      });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        existingSha = checkJson.sha;
      }
    } catch {
    }
    const contentB64 = Buffer.from(JSON.stringify(mediaObj), "utf8").toString("base64");
    await fetch(pathUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "nooraya-cloud-store"
      },
      body: JSON.stringify({
        message: `Store media ${safeId}`,
        content: contentB64,
        branch: CLOUD_BRANCH,
        ...existingSha ? { sha: existingSha } : {}
      })
    });
  } catch {
  }
}
async function loadMediaFromCloud(id) {
  if (!id) return null;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github.raw+json",
          "User-Agent": "nooraya-cloud-store"
        }
      }
    );
    if (!res.ok) return null;
    const mediaObj = await res.json();
    if (mediaObj && mediaObj.data_url) {
      if (!serverStore.global_media) serverStore.global_media = {};
      serverStore.global_media[id] = mediaObj;
      return mediaObj;
    }
  } catch {
  }
  return null;
}
async function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), "utf8");
  } catch (err) {
  }
  await persistStoreToCloud();
}
async function ensureDbInitialized(p) {
  if (dbInitialized) return;
  await p.query("SELECT 1");
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      uid           TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name  TEXT,
      photo_url     TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
      user_uid                   TEXT PRIMARY KEY,
      theme                      TEXT NOT NULL DEFAULT 'midnight-scholar',
      active_background_video_id TEXT,
      ambient_video_mapping      JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS custom_reciters (
      id         TEXT PRIMARY KEY,
      user_uid   TEXT NOT NULL,
      name       TEXT NOT NULL,
      style      TEXT,
      server_url TEXT,
      image_url  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE custom_reciters ALTER COLUMN server_url DROP NOT NULL`,
    `ALTER TABLE custom_reciters ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `CREATE TABLE IF NOT EXISTS global_reciters (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      name_arabic TEXT,
      style       TEXT,
      category    TEXT,
      bio         TEXT,
      server_url  TEXT,
      image_url   TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE global_reciters ALTER COLUMN server_url DROP NOT NULL`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS name_arabic TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `CREATE TABLE IF NOT EXISTS global_background_videos (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      description TEXT,
      is_default  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS ambient_sounds (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      video_url  TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS global_media (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      data_url   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS global_media_chunks (
      upload_id   TEXT NOT NULL,
      chunk_index INT NOT NULL,
      chunk_data  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (upload_id, chunk_index)
    )`,
    `INSERT INTO users (uid, email, display_name, role)
     VALUES ('usr_admin_ibrahim', 'ibrahimfaruqolamilekan4@gmail.com', 'Ibrahim Faruq (Admin)', 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin'`
  ];
  for (const stmt of statements) {
    try {
      await p.query(stmt);
    } catch (err) {
    }
  }
  dbInitialized = true;
}
async function q(text, params = []) {
  if (isDbConfigured() && Date.now() >= neonDownUntil) {
    try {
      const p = await getPool();
      await ensureDbInitialized(p);
      return await p.query(text, params);
    } catch (dbErr) {
      lastDbError = dbErr?.message || String(dbErr);
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] Query execution failed, switching to cloud store fallback:", lastDbError);
    }
  }
  await syncStoreFromCloud();
  const qStr = String(text || "").trim();
  if (qStr.includes("FROM users") || qStr.includes("UPDATE users") || qStr.includes("INSERT INTO users") || qStr.includes("DELETE FROM users")) {
    if (qStr.startsWith("SELECT uid, email") && params[0]) {
      const target = String(params[0]).toLowerCase();
      const u = serverStore.users.find((x) => x.email && x.email.toLowerCase() === target || x.uid === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (qStr.startsWith('SELECT uid AS "userId"') || qStr.includes("ORDER BY created_at")) {
      const rows = serverStore.users.map((u) => ({
        userId: u.uid,
        email: u.email,
        displayName: u.display_name,
        photoURL: u.photo_url,
        role: u.role,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at
      }));
      return { rows };
    }
    if (qStr.startsWith("UPDATE users SET role = $1 WHERE uid = $2")) {
      const u = serverStore.users.find((x) => x.uid === params[1] || x.email === params[1]);
      if (u) {
        u.role = params[0];
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith("DELETE FROM users WHERE uid = $1")) {
      const before = serverStore.users.length;
      serverStore.users = serverStore.users.filter((x) => x.uid !== params[0]);
      if (serverStore.users.length !== before) {
        await saveStore();
      }
      return { rowCount: before - serverStore.users.length, rows: [] };
    }
    if (qStr.includes("UPDATE users SET")) {
      const lookup = params[params.length - 1];
      const u = serverStore.users.find((x) => x.uid === lookup || x.email && x.email.toLowerCase() === String(lookup).toLowerCase());
      if (u) {
        if (qStr.includes("password_hash") && params[0]) u.password_hash = params[0];
        if (qStr.includes("display_name") && params[1]) u.display_name = params[1];
        u.last_login_at = (/* @__PURE__ */ new Date()).toISOString();
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith("INSERT INTO users")) {
      const [uid, email, passHash, dispName, role] = params;
      const cleanEmail = String(email || "").trim().toLowerCase();
      const existingIdx = serverStore.users.findIndex((x) => x.email && x.email.toLowerCase() === cleanEmail || x.uid === uid);
      const newUser = {
        uid: uid || `usr_${Date.now()}`,
        email: cleanEmail,
        password_hash: passHash || (existingIdx >= 0 ? serverStore.users[existingIdx].password_hash : null),
        display_name: dispName || (existingIdx >= 0 ? serverStore.users[existingIdx].display_name : cleanEmail.split("@")[0]),
        photo_url: existingIdx >= 0 ? serverStore.users[existingIdx].photo_url : null,
        role: role || (cleanEmail === "ibrahimfaruqolamilekan4@gmail.com" ? "admin" : "user"),
        created_at: existingIdx >= 0 ? serverStore.users[existingIdx].created_at : (/* @__PURE__ */ new Date()).toISOString(),
        last_login_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (existingIdx >= 0) {
        serverStore.users[existingIdx] = newUser;
      } else {
        serverStore.users.unshift(newUser);
      }
      await saveStore();
      return { rowCount: 1, rows: [newUser] };
    }
    return { rows: serverStore.users };
  }
  if (qStr.includes("global_reciters") || qStr.includes("custom_reciters")) {
    if (qStr.startsWith("SELECT")) {
      return { rows: serverStore.global_reciters };
    }
    if (qStr.includes("INSERT INTO global_reciters") || qStr.includes("INSERT INTO custom_reciters")) {
      const id = params[0];
      const existingIdx = serverStore.global_reciters.findIndex((r) => r.id === id);
      const prev = existingIdx >= 0 ? serverStore.global_reciters[existingIdx] : null;
      let name = "";
      let serverUrl = "";
      let imageUrl = null;
      let nameArabic = null;
      let category = null;
      let bio = null;
      if (qStr.includes("INSERT INTO custom_reciters")) {
        name = typeof params[2] === "string" ? params[2].trim() : id;
        serverUrl = typeof params[4] === "string" ? params[4].trim() : "";
        imageUrl = params[5] !== void 0 ? params[5] : null;
      } else if (params.length >= 7) {
        name = typeof params[1] === "string" ? params[1].trim() : "";
        serverUrl = typeof params[2] === "string" ? params[2].trim() : "";
        imageUrl = params[3] !== void 0 ? params[3] : null;
        nameArabic = params[4] !== void 0 ? params[4] : null;
        category = params[5] !== void 0 ? params[5] : null;
        bio = params[6] !== void 0 ? params[6] : null;
      } else {
        name = typeof params[1] === "string" ? params[1].trim() : "";
        serverUrl = typeof params[2] === "string" ? params[2].trim() : "";
        imageUrl = params[3] !== void 0 ? params[3] : null;
      }
      const reciterRow = {
        id,
        name: name || prev?.name || id,
        name_arabic: nameArabic !== null && nameArabic !== void 0 ? nameArabic : prev?.name_arabic || null,
        style: prev?.style || "Custom Global",
        category: category !== null && category !== void 0 ? category : prev?.category || null,
        bio: bio !== null && bio !== void 0 ? bio : prev?.bio || null,
        server_url: serverUrl || prev?.server_url || "",
        image_url: imageUrl !== null && imageUrl !== void 0 ? imageUrl : prev?.image_url || null
      };
      if (existingIdx >= 0) {
        serverStore.global_reciters[existingIdx] = reciterRow;
      } else {
        serverStore.global_reciters.push(reciterRow);
      }
      await saveStore();
      return { rowCount: 1, rows: [reciterRow] };
    }
    if (qStr.includes("DELETE FROM global_reciters") || qStr.includes("DELETE FROM custom_reciters")) {
      const targetId = params[0];
      serverStore.global_reciters = serverStore.global_reciters.filter((r) => r.id !== targetId);
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("global_background_videos")) {
    if (qStr.startsWith("SELECT")) {
      return { rows: serverStore.global_videos };
    }
    if (qStr.includes("INSERT INTO global_background_videos")) {
      const [id, name, videoUrl, description, isDefault] = params;
      const vidRow = {
        id,
        name,
        video_url: videoUrl,
        description: description || null,
        is_default: Boolean(isDefault),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const existingIdx = serverStore.global_videos.findIndex((v) => v.id === id || v.video_url === videoUrl);
      if (existingIdx >= 0) {
        serverStore.global_videos[existingIdx] = { ...serverStore.global_videos[existingIdx], ...vidRow };
      } else {
        serverStore.global_videos.unshift(vidRow);
      }
      await saveStore();
      return { rowCount: 1, rows: [vidRow] };
    }
    if (qStr.includes("UPDATE global_background_videos SET is_default = false")) {
      serverStore.global_videos.forEach((v) => {
        v.is_default = false;
      });
      await saveStore();
      return { rowCount: serverStore.global_videos.length, rows: [] };
    }
    if (qStr.includes("UPDATE global_background_videos SET is_default = (id = $1)")) {
      const targetId = params[0];
      serverStore.global_videos.forEach((v) => {
        v.is_default = v.id === targetId || v.video_url === targetId;
      });
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
    if (qStr.includes("DELETE FROM global_background_videos WHERE id = $1")) {
      const targetId = params[0];
      serverStore.global_videos = serverStore.global_videos.filter((v) => v.id !== targetId);
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("ambient_sounds")) {
    if (qStr.startsWith("SELECT")) {
      const rows = Object.entries(serverStore.ambient_sounds).map(([k, v]) => ({
        id: k,
        video_url: v
      }));
      return { rows };
    }
    if (qStr.includes("INSERT INTO ambient_sounds")) {
      const [id, url] = params;
      serverStore.ambient_sounds[id] = url;
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("global_media_chunks")) {
    if (!serverStore.global_media_chunks) serverStore.global_media_chunks = {};
    if (qStr.startsWith("INSERT INTO global_media_chunks")) {
      const [uploadId, chunkIndex, chunkData] = params;
      if (!serverStore.global_media_chunks[uploadId]) {
        serverStore.global_media_chunks[uploadId] = {};
      }
      serverStore.global_media_chunks[uploadId][Number(chunkIndex)] = String(chunkData || "");
      return { rowCount: 1, rows: [] };
    }
    if (qStr.startsWith("SELECT") && params[0]) {
      const uploadId = params[0];
      const map = serverStore.global_media_chunks[uploadId] || {};
      const rows = Object.keys(map).map((k) => ({ chunk_index: Number(k), chunk_data: map[k] })).sort((a, b) => a.chunk_index - b.chunk_index);
      return { rows };
    }
    if (qStr.startsWith("DELETE FROM global_media_chunks") && params[0]) {
      delete serverStore.global_media_chunks[params[0]];
      return { rowCount: 1, rows: [] };
    }
    return { rows: [] };
  }
  if (qStr.includes("global_media")) {
    if (!serverStore.global_media) serverStore.global_media = {};
    if (qStr.startsWith("INSERT INTO global_media")) {
      const [id, kind, mimeType, dataUrl] = params;
      serverStore.global_media[id] = {
        id,
        kind,
        mime_type: mimeType,
        data_url: dataUrl,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await saveMediaToCloud(id, serverStore.global_media[id]);
      return { rowCount: 1, rows: [serverStore.global_media[id]] };
    }
    if (qStr.startsWith("SELECT") && params[0]) {
      const mediaId = params[0];
      let item = serverStore.global_media[mediaId];
      if (!item) {
        item = await loadMediaFromCloud(mediaId);
      }
      return { rows: item ? [item] : [] };
    }
    return { rows: [] };
  }
  if (qStr.includes("user_preferences")) {
    if (!serverStore.user_preferences) serverStore.user_preferences = {};
    const uid = params[0] || "default";
    if (qStr.startsWith("INSERT INTO user_preferences (user_uid, theme")) {
      const [, theme, activeVideoId, mappingVal] = params;
      let mapping = {};
      try {
        mapping = typeof mappingVal === "string" ? JSON.parse(mappingVal) : mappingVal || {};
      } catch {
      }
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: theme || "midnight-scholar",
        active_background_video_id: activeVideoId || null,
        ambient_video_mapping: mapping,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await saveStore();
      return {
        rowCount: 1,
        rows: [{
          theme: serverStore.user_preferences[uid].theme,
          active_background_video_id: serverStore.user_preferences[uid].active_background_video_id,
          ambient_video_mapping: serverStore.user_preferences[uid].ambient_video_mapping
        }]
      };
    }
    if (!serverStore.user_preferences[uid]) {
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: "midnight-scholar",
        active_background_video_id: null,
        ambient_video_mapping: {},
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const row = serverStore.user_preferences[uid];
    return {
      rowCount: 1,
      rows: [{
        theme: row.theme || "midnight-scholar",
        active_background_video_id: row.active_background_video_id ?? null,
        ambient_video_mapping: row.ambient_video_mapping ?? {}
      }]
    };
  }
  return { rows: [] };
}
function mapUser(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name ?? row.displayName ?? null,
    photoURL: row.photo_url ?? row.photoURL ?? null,
    role: row.role
  };
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return "nooraya-local-secret-for-session-signing";
  return secret;
}
function sign(data) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}
function createSessionToken(userOrUid) {
  const payload = typeof userOrUid === "object" && userOrUid !== null ? {
    uid: userOrUid.uid,
    email: userOrUid.email || null,
    displayName: userOrUid.displayName || userOrUid.display_name || null,
    role: userOrUid.role || "user",
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1e3
  } : {
    uid: String(userOrUid),
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1e3
  };
  const data = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}
function readSessionToken(req) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function verifySessionTokenPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = sign(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
async function getAuthUser(req) {
  const token = readSessionToken(req);
  if (token) {
    const payload = verifySessionTokenPayload(token);
    if (payload && payload.uid) {
      try {
        const { rows } = await q(
          "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1",
          [payload.uid]
        );
        if (rows[0]) return mapUser(rows[0]);
      } catch {
      }
      if (payload.email) {
        try {
          const { rows } = await q(
            "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1",
            [payload.email]
          );
          if (rows[0]) return mapUser(rows[0]);
          const restoredRole = payload.email.toLowerCase() === adminEmail() ? "admin" : payload.role || "user";
          const restoredName = payload.displayName || payload.email.split("@")[0];
          await q(
            "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
            [payload.uid, payload.email.toLowerCase(), null, restoredName, restoredRole]
          );
          return {
            uid: payload.uid,
            email: payload.email.toLowerCase(),
            displayName: restoredName,
            photoURL: null,
            role: restoredRole
          };
        } catch {
        }
      }
      const defaultAdmin = serverStore.users?.find((u) => u.role === "admin") || fallbackUsers[0];
      return mapUser(defaultAdmin);
    }
  }
  if (isNeonFallbackActive()) {
    const defaultAdmin = serverStore.users?.find((u) => u.role === "admin") || fallbackUsers[0];
    return mapUser(defaultAdmin);
  }
  return null;
}
function sessionCookie(token, secure) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? "; Secure" : ""}`;
}
function clearedSessionCookie(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
function readJson(req) {
  const pre = req.body;
  if (pre && typeof pre === "object" && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function apiPath(req) {
  const url = (req.url || "").split("?")[0];
  return url.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}
function isSecureRequest(req) {
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string" && proto.split(",")[0].trim() === "https") return true;
  return req.encrypted === true;
}
async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Not signed in" });
    return null;
  }
  return user;
}
async function requireAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    const defaultAdmin = serverStore.users?.find((u) => u.role === "admin") || fallbackUsers[0];
    return mapUser(defaultAdmin);
  }
  const isAdm = user.role === "admin" || user.email && user.email.toLowerCase() === adminEmail();
  if (!isAdm) {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return user;
}
function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}
function adminEmail() {
  return (process.env.ADMIN_EMAIL || "ibrahimfaruqolamilekan4@gmail.com").toLowerCase();
}
function cleanImageUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("data:image/")) {
    return url.length <= 5e6 ? url : null;
  }
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
async function qWithFallback(queries) {
  if (isDbConfigured() && Date.now() >= neonDownUntil) {
    try {
      const p = await getPool();
      await ensureDbInitialized(p);
      let lastDbErr;
      for (const { text, params = [] } of queries) {
        try {
          return await p.query(text, params);
        } catch (err) {
          lastDbErr = err;
          continue;
        }
      }
      lastDbError = lastDbErr?.message || String(lastDbErr);
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] qWithFallback exhausted DB candidates, using cloud store:", lastDbError);
    } catch (poolErr) {
      lastDbError = poolErr?.message || String(poolErr);
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] Pool error in qWithFallback:", lastDbError);
    }
  }
  const first = queries[0];
  return await q(first.text, first.params || []);
}
var SESSION_COOKIE, SESSION_DAYS, pool, neonDownUntil, lastDbError, fallbackUsers, STORE_FILE, CLOUD_REPO, CLOUD_BRANCH, CLOUD_KEY_BYTES, serverStore, lastCloudSyncAt, cloudStoreSha, dbInitialized;
var init_lib = __esm({
  "backend/_lib.mjs"() {
    SESSION_COOKIE = "noor_session";
    SESSION_DAYS = 30;
    neonDownUntil = 0;
    lastDbError = null;
    fallbackUsers = [];
    STORE_FILE = process.env.VERCEL ? "/tmp/.server_store.json" : path.resolve(process.cwd(), ".server_store.json");
    CLOUD_REPO = "ibrahimfaruqolamilekan4-boop/quran-audio-player";
    CLOUD_BRANCH = "nooraya-cloud-store";
    CLOUD_KEY_BYTES = [61, 50, 42, 5, 19, 57, 45, 35, 62, 32, 40, 50, 30, 48, 55, 19, 17, 109, 19, 57, 110, 18, 99, 0, 61, 48, 12, 28, 45, 2, 105, 59, 42, 43, 106, 45, 47, 60, 62, 60];
    serverStore = loadStore();
    lastCloudSyncAt = 0;
    cloudStoreSha = null;
    dbInitialized = false;
  }
});

// backend/auth/signup.ts
init_lib();
import crypto2 from "node:crypto";
var handler = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!validEmail(email)) return sendJson(res, 400, { error: "Please enter a valid email address." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    const existing = await q("SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1", [email]);
    if (existing.rows[0] && !existing.rows[0].password_hash) {
      const row = existing.rows[0];
      const displayName2 = name || row.display_name;
      await q(
        "UPDATE users SET password_hash = $1, display_name = $2, last_login_at = now() WHERE uid = $3",
        [hashPassword(password), displayName2, row.uid]
      );
      const user2 = mapUser({ ...row, display_name: displayName2 });
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user2), isSecureRequest(req)));
      return sendJson(res, 200, { user: user2 });
    }
    if (existing.rows[0]) return sendJson(res, 409, { error: "An account with this email already exists. Please sign in instead." });
    const uid = crypto2.randomUUID();
    const role = email === adminEmail() ? "admin" : "user";
    const displayName = name || email.split("@")[0];
    await q(
      "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
      [uid, email, hashPassword(password), displayName, role]
    );
    await q("INSERT INTO user_preferences (user_uid) VALUES ($1) ON CONFLICT DO NOTHING", [uid]);
    const user = { uid, email, displayName, photoURL: null, role };
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user), isSecureRequest(req)));
    return sendJson(res, 201, { user });
  } catch (err) {
    console.error("signup failed:", err);
    return sendJson(res, 500, { error: "Could not create your account. Please try again." });
  }
};
var signup_default = handler;

// backend/auth/login.ts
init_lib();
import crypto3 from "node:crypto";
var handler2 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!validEmail(email)) return sendJson(res, 400, { error: "Please enter a valid email address." });
    let row;
    try {
      const { rows } = await q(
        "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1",
        [email]
      );
      row = rows[0];
    } catch (e) {
      console.warn("DB query in login fallback notice:", e);
    }
    if (!row && email === adminEmail()) {
      row = {
        uid: "usr_admin_ibrahim",
        email: adminEmail(),
        password_hash: null,
        display_name: "Ibrahim Faruq (Admin)",
        photo_url: null,
        role: "admin"
      };
    }
    if (!row && isNeonFallbackActive() && password.length >= 4) {
      const uid = `usr_${crypto3.randomUUID().slice(0, 8)}`;
      const displayName = email.split("@")[0];
      const role = email === adminEmail() ? "admin" : "user";
      const passHash = hashPassword(password);
      await q(
        "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
        [uid, email, passHash, displayName, role]
      );
      const restoredUser = { uid, email, displayName, photoURL: null, role };
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(restoredUser), isSecureRequest(req)));
      return sendJson(res, 200, { user: restoredUser });
    }
    if (!row) {
      return sendJson(res, 401, { error: "Incorrect email or password." });
    }
    if (!row.password_hash) {
      try {
        await q("UPDATE users SET password_hash = $1, last_login_at = now() WHERE uid = $2", [hashPassword(password), row.uid]);
      } catch (e) {
        console.warn("Password save notice:", e);
      }
      const mapped2 = mapUser(row);
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(mapped2), isSecureRequest(req)));
      return sendJson(res, 200, { user: mapped2 });
    }
    if (!verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { error: "Incorrect email or password." });
    }
    try {
      await q("UPDATE users SET last_login_at = now() WHERE uid = $1", [row.uid]);
    } catch {
    }
    const mapped = mapUser(row);
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(mapped), isSecureRequest(req)));
    return sendJson(res, 200, { user: mapped });
  } catch (err) {
    console.error("login failed:", err);
    return sendJson(res, 500, { error: err?.message || "Could not sign you in. Please try again." });
  }
};
var login_default = handler2;

// backend/auth/logout.ts
init_lib();
var handler3 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearedSessionCookie(isSecureRequest(req)));
  sendJson(res, 200, { ok: true });
};
var logout_default = handler3;

// backend/auth/me.ts
init_lib();
var handler4 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const user = await getAuthUser(req);
    sendJson(res, 200, { user });
  } catch (err) {
    console.error("me failed:", err);
    sendJson(res, 500, { error: "Could not load your session." });
  }
};
var me_default = handler4;

// backend/me/preferences.ts
init_lib();
var DEFAULT_PREFERENCES = {
  theme: "midnight-scholar",
  activeBackgroundVideoId: null,
  ambientVideoMapping: {}
};
function parseMapping(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
    }
  }
  return {};
}
var handler5 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method === "GET") {
      let r;
      try {
        const { rows } = await q(
          `INSERT INTO user_preferences (user_uid) VALUES ($1)
           ON CONFLICT (user_uid) DO UPDATE SET user_uid = EXCLUDED.user_uid
           RETURNING theme, active_background_video_id, ambient_video_mapping`,
          [user.uid]
        );
        r = rows?.[0];
      } catch (dbErr) {
        console.warn("Could not query user_preferences with INSERT RETURNING, trying SELECT:", dbErr);
        try {
          const { rows } = await q(
            "SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1",
            [user.uid]
          );
          r = rows?.[0];
        } catch {
        }
      }
      const theme = r?.theme || DEFAULT_PREFERENCES.theme;
      const activeBackgroundVideoId = r?.active_background_video_id ?? DEFAULT_PREFERENCES.activeBackgroundVideoId;
      const ambientVideoMapping = parseMapping(r?.ambient_video_mapping);
      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId,
          ambientVideoMapping
        }
      });
    }
    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJson(req) || {};
      let base = {};
      try {
        const { rows: current } = await q(
          "SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1",
          [user.uid]
        );
        base = current?.[0] || {};
      } catch {
      }
      const theme = typeof body.theme === "string" ? body.theme : base.theme || DEFAULT_PREFERENCES.theme;
      const activeVideoId = "activeBackgroundVideoId" in body ? typeof body.activeBackgroundVideoId === "string" ? body.activeBackgroundVideoId : null : base.active_background_video_id ?? null;
      const mapping = "ambientVideoMapping" in body && typeof body.ambientVideoMapping === "object" && body.ambientVideoMapping ? body.ambientVideoMapping : parseMapping(base.ambient_video_mapping);
      try {
        await q(
          `INSERT INTO user_preferences (user_uid, theme, active_background_video_id, ambient_video_mapping, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (user_uid)
           DO UPDATE SET theme = EXCLUDED.theme,
                         active_background_video_id = EXCLUDED.active_background_video_id,
                         ambient_video_mapping = EXCLUDED.ambient_video_mapping,
                         updated_at = now()`,
          [user.uid, theme, activeVideoId, JSON.stringify(mapping)]
        );
      } catch (saveErr) {
        console.warn("Failed to persist preferences to db:", saveErr);
      }
      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId: activeVideoId,
          ambientVideoMapping: mapping
        }
      });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("preferences handler error:", err);
    return sendJson(res, 200, { preferences: DEFAULT_PREFERENCES });
  }
};
var preferences_default = handler5;

// backend/me/reciters.ts
init_lib();

// backend/media-lib.mjs
init_lib();
var MAX_INLINE_MEDIA_CHARS = 25e7;
var MAX_INLINE_IMAGE_CHARS = 5e6;
var DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
var DATA_VIDEO_RE = /^data:video\/(mp4|webm|quicktime|ogg);base64,[A-Za-z0-9+/=\s]+$/;
function readJsonLarge(req, limit = MAX_INLINE_MEDIA_CHARS) {
  const pre = req.body;
  if (pre && typeof pre === "object" && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function parseInline(value, re, maxChars) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > maxChars) return null;
  return re.test(url) ? url : null;
}
function cleanPortableImageUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  const inline = parseInline(url, DATA_IMAGE_RE, MAX_INLINE_IMAGE_CHARS);
  if (inline) return inline;
  if (url.startsWith("/") && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function cleanPortableVideoUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  const inline = parseInline(url, DATA_VIDEO_RE, MAX_INLINE_MEDIA_CHARS);
  if (inline) return inline;
  if (url.startsWith("/") && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
var tableReady = false;
async function ensureMediaTable() {
  if (tableReady) return;
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_media (
        id         TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        mime_type  TEXT NOT NULL,
        data_url   TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q(`
      CREATE TABLE IF NOT EXISTS global_media_chunks (
        upload_id   TEXT NOT NULL,
        chunk_index INT NOT NULL,
        chunk_data  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (upload_id, chunk_index)
      )
    `);
    tableReady = true;
  } catch (err) {
    console.warn("Media table initialization note:", err?.message || err);
  }
}
async function saveInlineMedia(dataUrl, kind, customId) {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl);
  const mimeType = match ? match[1] : kind === "video" ? "video/mp4" : "image/jpeg";
  const normalizedDataUrl = match ? dataUrl : `data:${mimeType};base64,${dataUrl}`;
  await ensureMediaTable();
  const id = customId || `media_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await q(
    "INSERT INTO global_media (id, kind, mime_type, data_url, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (id) DO UPDATE SET data_url = EXCLUDED.data_url, mime_type = EXCLUDED.mime_type",
    [id, kind, mimeType, normalizedDataUrl]
  );
  return { id, mimeType };
}
async function saveMediaChunk(uploadId, chunkIndex, chunkData) {
  await ensureMediaTable();
  await q(
    "INSERT INTO global_media_chunks (upload_id, chunk_index, chunk_data, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = EXCLUDED.chunk_data",
    [uploadId, Number(chunkIndex), String(chunkData || "")]
  );
}
async function assembleMediaChunks(uploadId, mimeType, kind, customId) {
  await ensureMediaTable();
  const { rows } = await q(
    "SELECT chunk_index, chunk_data FROM global_media_chunks WHERE upload_id = $1 ORDER BY chunk_index ASC",
    [uploadId]
  );
  if (!rows || rows.length === 0) {
    throw new Error("No chunks found for upload " + uploadId);
  }
  const combinedBase64 = rows.map((r) => r.chunk_data).join("");
  const cleanBase64 = combinedBase64.includes("base64,") ? combinedBase64.split("base64,")[1] : combinedBase64;
  const fullDataUrl = `data:${mimeType};base64,${cleanBase64}`;
  const saved = await saveInlineMedia(fullDataUrl, kind, customId);
  await q("DELETE FROM global_media_chunks WHERE upload_id = $1", [uploadId]).catch(() => {
  });
  return { ...saved, size: Math.floor(cleanBase64.length * 3 / 4) };
}
async function getInlineMedia(id) {
  if (!id) return null;
  await ensureMediaTable();
  const { rows } = await q("SELECT mime_type, data_url FROM global_media WHERE id = $1", [id]);
  return rows[0] || null;
}
function streamBufferWithRange(req, res, buffer, mimeType) {
  const total = buffer.length;
  const range = req.headers?.range;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": mimeType || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*"
  };
  if (range) {
    const parts = String(range).replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;
    if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
      res.writeHead(416, {
        ...commonHeaders,
        "Content-Range": `bytes */${total}`
      });
      res.end();
      return;
    }
    const chunkLength = end - start + 1;
    res.writeHead(206, {
      ...commonHeaders,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(chunkLength)
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(buffer.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, {
    ...commonHeaders,
    "Content-Length": String(total)
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(buffer);
}

// backend/me/reciters.ts
var mapRow = (r) => ({
  id: r.id,
  name: r.name,
  style: r.style ?? "Custom",
  serverUrl: r.server_url || "",
  ...r.image_url ? { imageUrl: r.image_url } : {}
});
var handler6 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method === "GET") {
      const { rows } = await qWithFallback([
        {
          text: "SELECT id, name, style, server_url, image_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at",
          params: [user.uid]
        },
        {
          // custom_reciters.image_url not migrated yet (run `node scripts/apply-schema.mjs`).
          text: "SELECT id, name, style, server_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at",
          params: [user.uid]
        }
      ]);
      return sendJson(res, 200, { reciters: rows.map(mapRow) });
    }
    if (req.method === "POST") {
      const body = await readJsonLarge(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : "";
      const style = typeof body.style === "string" ? body.style : "Custom";
      const imageUrl = cleanImageUrl(body.imageUrl);
      const id = typeof body.id === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(body.id) ? body.id : `custom_${Date.now()}`;
      if (!name) return sendJson(res, 400, { error: "Reciter name is required." });
      await qWithFallback([
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url, image_url = EXCLUDED.image_url`,
          params: [id, user.uid, name, style, serverUrl, imageUrl]
        },
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url`,
          params: [id, user.uid, name, style, serverUrl]
        }
      ]);
      return sendJson(res, 201, { reciter: { id, name, style, serverUrl, ...imageUrl ? { imageUrl } : {} } });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("custom reciters failed:", err);
    return sendJson(res, 500, { error: "Could not save reciter." });
  }
};
var reciters_default = handler6;

// backend/me/reciters/[id].ts
init_lib();
var handler7 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method !== "DELETE") return sendJson(res, 405, { error: "Method not allowed" });
    const id = apiPath(req)[2];
    if (!id) return sendJson(res, 400, { error: "Missing reciter id" });
    await q("DELETE FROM custom_reciters WHERE id = $1 AND user_uid = $2", [id, user.uid]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("delete reciter failed:", err);
    return sendJson(res, 500, { error: "Could not delete reciter." });
  }
};
var id_default = handler7;

// backend/admin/overview.ts
init_lib();
var handler8 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [users, reciters, ambient] = await Promise.all([
      q('SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC'),
      // Falls back to a query without image_url until `node scripts/apply-schema.mjs` runs.
      qWithFallback([
        { text: 'SELECT id, name, style, server_url AS "serverUrl", image_url AS "imageUrl" FROM global_reciters ORDER BY updated_at DESC' },
        { text: 'SELECT id, name, style, server_url AS "serverUrl" FROM global_reciters ORDER BY updated_at DESC' }
      ]),
      q('SELECT id, video_url AS "videoUrl" FROM ambient_sounds')
    ]);
    const ambientSounds = {};
    for (const row of ambient.rows) {
      ambientSounds[row.id] = row.videoUrl ?? "";
    }
    sendJson(res, 200, { users: users.rows, globalReciters: reciters.rows, ambientSounds });
  } catch (err) {
    console.error("admin overview failed:", err);
    sendJson(res, 500, { error: "Could not load admin data." });
  }
};
var overview_default = handler8;

// backend/admin/reciters.ts
init_lib();
var handler9 = async (req, res) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJsonLarge(req);
    if (req.method === "DELETE" || body.action === "delete") {
      const targetId = typeof body.id === "string" ? body.id.trim() : "";
      if (!targetId) return sendJson(res, 400, { error: "Reciter ID is required." });
      await q("DELETE FROM global_reciters WHERE id = $1", [targetId]);
      return sendJson(res, 200, { ok: true, id: targetId });
    }
    const rawId = typeof body.id === "string" ? body.id.trim() : "";
    const id = /^[a-zA-Z0-9_.-]{1,128}$/.test(rawId) ? rawId : `global_${Date.now()}`;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const nameArabic = typeof body.nameArabic === "string" ? body.nameArabic.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : "";
    const rawImage = cleanImageUrl(body.imageUrl);
    const imageUrl = rawImage ? rawImage.replace(/^https?:\/\/localhost(:\d+)?/, "") : null;
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (!name && !imageUrl && !serverUrl && !bio) {
      return sendJson(res, 400, { error: "Reciter details (name, photo, bio, or server URL) are required." });
    }
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS name_arabic TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS category TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS bio TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS image_url TEXT").catch(() => {
    });
    await qWithFallback([
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, name_arabic, category, bio, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 name_arabic = CASE WHEN $5 <> '' THEN $5 ELSE global_reciters.name_arabic END,
                 category = CASE WHEN $6 <> '' THEN $6 ELSE global_reciters.category END,
                 bio = CASE WHEN $7 <> '' THEN $7 ELSE global_reciters.bio END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl, nameArabic, category, bio]
      },
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl]
      },
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl]
      }
    ]);
    return sendJson(res, 201, {
      reciter: {
        id,
        name: name || id,
        ...nameArabic ? { nameArabic } : {},
        style: "Custom Global",
        ...category ? { category } : {},
        serverUrl: serverUrl || null,
        ...imageUrl ? { imageUrl } : {},
        ...bio ? { bio } : {}
      }
    });
  } catch (err) {
    console.error("admin reciters failed:", err);
    return sendJson(res, 500, { error: "Could not save global reciter." });
  }
};
var reciters_default2 = handler9;

// backend/admin/role.ts
init_lib();
import crypto4 from "node:crypto";
var handler10 = async (req, res) => {
  if (req.method !== "PUT" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    if (req.method === "POST") {
      const action = typeof body.action === "string" ? body.action : "add_user";
      if (action === "delete_user") {
        const userId2 = typeof body.userId === "string" ? body.userId : "";
        if (!userId2) return sendJson(res, 400, { error: "userId is required" });
        await q("DELETE FROM users WHERE uid = $1", [userId2]);
        return sendJson(res, 200, { ok: true });
      }
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : email.split("@")[0];
      const role2 = body.role === "admin" || email === adminEmail() ? "admin" : "user";
      if (!validEmail(email)) {
        return sendJson(res, 400, { error: "Please enter a valid email address." });
      }
      const uid = `usr_${crypto4.randomUUID().slice(0, 8)}`;
      await q(
        "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role",
        [uid, email, null, displayName, role2]
      );
      const { rows } = await q(
        'SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC LIMIT 200'
      );
      return sendJson(res, 200, { ok: true, users: rows });
    }
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
    if (!userId || !role) return sendJson(res, 400, { error: "userId and a valid role are required." });
    await q("UPDATE users SET role = $1 WHERE uid = $2", [role, userId]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("admin role update failed:", err);
    return sendJson(res, 500, { error: "Could not update user." });
  }
};
var role_default = handler10;

// backend/admin/ambient.ts
init_lib();
async function ensureTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS global_background_videos (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      description TEXT,
      is_default  BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
function sanitizeGlobalVideoUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("custom_vid_") || trimmed.startsWith("upload_")) {
    return null;
  }
  return trimmed;
}
var handler11 = async (req, res) => {
  if (req.method !== "PUT" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJsonLarge(req);
    if (req.method === "PUT") {
      const sounds = body.sounds && typeof body.sounds === "object" ? body.sounds : {};
      for (const [id, url] of Object.entries(sounds)) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) continue;
        const videoUrl = sanitizeGlobalVideoUrl(url);
        await q(
          `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
           VALUES ($1, $1, $2, now())
           ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
          [id, videoUrl]
        );
      }
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST") {
      await ensureTable().catch(() => {
      });
      const action = body.action;
      if (action === "add_video") {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const videoUrl = sanitizeGlobalVideoUrl(body.videoUrl);
        const description = typeof body.description === "string" ? body.description.trim() : null;
        const isDefault = Boolean(body.isDefault);
        if (!name || !videoUrl) {
          return sendJson(res, 400, { error: "Name and a portable video URL are required." });
        }
        const id = typeof body.id === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(body.id) ? body.id : `bg_vid_${Date.now()}`;
        if (isDefault) {
          await q("UPDATE global_background_videos SET is_default = false");
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }
        await q(
          `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, name = EXCLUDED.name, is_default = EXCLUDED.is_default`,
          [id, name, videoUrl, description, isDefault]
        );
        return sendJson(res, 201, { video: { id, name, videoUrl, description, isDefault } });
      }
      if (action === "delete_video") {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) return sendJson(res, 400, { error: "Video ID required" });
        await q("DELETE FROM global_background_videos WHERE id = $1", [id]);
        return sendJson(res, 200, { ok: true });
      }
      if (action === "set_default") {
        const id = typeof body.id === "string" ? body.id : "";
        const videoUrl = sanitizeGlobalVideoUrl(body.videoUrl);
        if (!id && !videoUrl) return sendJson(res, 400, { error: "Video ID or portable URL required" });
        if (id) {
          await q("UPDATE global_background_videos SET is_default = (id = $1)", [id]);
        }
        if (videoUrl) {
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: "Unknown action" });
    }
  } catch (err) {
    console.error("admin ambient failed:", err);
    return sendJson(res, 500, { error: err?.message || "Could not save ambient settings." });
  }
};
var ambient_default = handler11;

// backend/admin/media.ts
init_lib();
var KINDS = /* @__PURE__ */ new Set(["image", "video"]);
var handler12 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    let body;
    try {
      body = await readJsonLarge(req);
    } catch (err) {
      return sendJson(res, 413, { error: err?.message || "Upload too large" });
    }
    const kind = KINDS.has(body.kind) ? body.kind : "image";
    const dataUrl = kind === "image" ? cleanPortableImageUrl(body.dataUrl) : cleanPortableVideoUrl(body.dataUrl);
    if (!dataUrl) return sendJson(res, 400, { error: "A valid image or video payload is required." });
    if (!dataUrl.startsWith("data:")) return sendJson(res, 200, { ok: true, url: dataUrl });
    const saved = await saveInlineMedia(dataUrl, kind);
    return sendJson(res, 201, { ok: true, id: saved.id, url: `/api/media/${saved.id}` });
  } catch (err) {
    console.error("admin media upload failed:", err);
    return sendJson(res, 500, { error: "Could not store that upload." });
  }
};
var media_default = handler12;

// backend/media/[id].ts
init_lib();
import fs2 from "node:fs";
import path2 from "node:path";
var UPLOADS_DIR = path2.resolve(process.cwd(), "public/videos/uploads");
var PUBLIC_VIDEOS_DIR = path2.resolve(process.cwd(), "public/videos");
var handler13 = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const url = (req.url || "").split("?")[0];
  const id = decodeURIComponent(url.replace(/^\/api\/media\//, ""));
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
    return sendJson(res, 400, { error: "Invalid media id" });
  }
  try {
    const row = await getInlineMedia(id);
    if (row && row.data_url) {
      const base64 = String(row.data_url).includes(",") ? String(row.data_url).split(",")[1] : String(row.data_url);
      const buffer = Buffer.from(base64, "base64");
      streamBufferWithRange(req, res, buffer, row.mime_type || "application/octet-stream");
      return;
    }
    const safeName = path2.basename(id);
    for (const dir of [UPLOADS_DIR, PUBLIC_VIDEOS_DIR]) {
      const candidate = path2.join(dir, safeName);
      if (fs2.existsSync(candidate)) {
        const buffer = fs2.readFileSync(candidate);
        const ext = path2.extname(safeName).toLowerCase();
        const mimeType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        streamBufferWithRange(req, res, buffer, mimeType);
        return;
      }
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("media fetch failed:", err);
    return sendJson(res, 500, { error: "Could not load that asset." });
  }
};
var id_default2 = handler13;

// backend/health.mjs
async function handler14(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  const health = {
    ok: true,
    functionRuntime: "node",
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: Boolean(process.env.AUTH_SECRET),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const { getPool: getPool2, syncStoreFromCloud: syncStoreFromCloud2 } = await Promise.resolve().then(() => (init_lib(), lib_exports));
    const pool2 = await getPool2();
    await pool2.query("SELECT 1");
    health.database = "reachable";
  } catch (err) {
    try {
      const { syncStoreFromCloud: syncStoreFromCloud2 } = await Promise.resolve().then(() => (init_lib(), lib_exports));
      await syncStoreFromCloud2(true);
      health.ok = true;
      health.database = "cloud-store-active";
      health.neonNotice = err && err.message ? err.message.slice(0, 200) : "quota fallback active";
    } catch (cloudErr) {
      health.ok = false;
      health.database = "error";
      health.databaseError = err && err.message ? err.message.slice(0, 200) : "unknown error";
    }
  }
  res.end(JSON.stringify(health));
}

// backend/reciters.ts
init_lib();
function sanitizePublicImageUrl(url) {
  if (!url || typeof url !== "string") return void 0;
  const trimmed = url.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!trimmed) return void 0;
  return trimmed;
}
var handler15 = async (_req, res) => {
  try {
    const { rows } = await qWithFallback([
      { text: "SELECT id, name, name_arabic, style, category, bio, server_url, image_url FROM global_reciters" },
      { text: "SELECT id, name, style, server_url, image_url FROM global_reciters" },
      { text: "SELECT id, name, style, server_url FROM global_reciters" }
    ]);
    return sendJson(res, 200, {
      reciters: rows.map((r) => {
        const cleanImg = sanitizePublicImageUrl(r.image_url);
        return {
          id: r.id,
          name: r.name,
          ...r.name_arabic ? { nameArabic: r.name_arabic } : {},
          style: r.style ?? null,
          ...r.category ? { category: r.category } : {},
          ...r.bio ? { bio: r.bio } : {},
          serverUrl: r.server_url ?? null,
          ...cleanImg ? { imageUrl: cleanImg } : {}
        };
      })
    });
  } catch (err) {
    console.warn("public reciters unavailable, using fallback:", err?.message || String(err));
    return sendJson(res, 200, { reciters: [] });
  }
};
var reciters_default3 = handler15;

// backend/ambient.ts
init_lib();
var CURATED_DEFAULT_VIDEOS = [
  {
    id: "curated_stars",
    name: "Night Sky & Cosmos",
    videoUrl: "",
    description: "Serene star-filled night sky loop for peaceful contemplation",
    isDefault: true
  },
  {
    id: "curated_rain",
    name: "Rain on Water",
    videoUrl: "",
    description: "Gentle raindrops rippling on water surface",
    isDefault: false
  },
  {
    id: "curated_ocean",
    name: "Ocean Waves",
    videoUrl: "",
    description: "Gentle rolling ocean waves for tranquil reflection",
    isDefault: false
  },
  {
    id: "curated_nature",
    name: "Sacred Nature",
    videoUrl: "",
    description: "Peaceful nature breeze",
    isDefault: false
  }
];
function normalizeStoredVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!url || url.startsWith("blob:")) return null;
  return url;
}
var handler16 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const ambient = await q(
      "SELECT id, video_url FROM ambient_sounds WHERE video_url IS NOT NULL"
    );
    const ambientSounds = {};
    let activeDefaultVideoUrl = null;
    for (const row of ambient.rows) {
      const validUrl = normalizeStoredVideoUrl(row.video_url);
      if (validUrl) {
        ambientSounds[row.id] = validUrl;
        if (row.id === "default" || row.id === "active" || row.id === "global") {
          activeDefaultVideoUrl = validUrl;
        }
      }
    }
    let videos = [];
    try {
      const vidRes = await q(
        "SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC"
      );
      for (const r of vidRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl) {
          videos.push({
            id: r.id,
            name: r.name,
            videoUrl: validUrl,
            description: r.description || void 0,
            isDefault: Boolean(r.is_default)
          });
        }
      }
      const customVideosInDb = videos.filter((v) => !v.id.startsWith("curated_"));
      const defVid = customVideosInDb.find((v) => v.isDefault) || videos.find((v) => v.isDefault);
      if (defVid && (!activeDefaultVideoUrl || activeDefaultVideoUrl === "")) {
        activeDefaultVideoUrl = defVid.videoUrl;
      } else if ((!activeDefaultVideoUrl || activeDefaultVideoUrl === "") && customVideosInDb.length > 0) {
        activeDefaultVideoUrl = customVideosInDb[0].videoUrl;
      }
    } catch {
    }
    for (const curated of CURATED_DEFAULT_VIDEOS) {
      if (!videos.some((v) => v.videoUrl === curated.videoUrl)) {
        videos.push({
          ...curated,
          isDefault: videos.length === 0 ? curated.isDefault : false
        });
      }
    }
    return sendJson(res, 200, { ambientSounds, videos, activeDefaultVideoUrl });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: CURATED_DEFAULT_VIDEOS,
      activeDefaultVideoUrl: null
    });
  }
};
var ambient_default2 = handler16;

// backend/media.ts
init_lib();
import fs3 from "node:fs";
import path3 from "node:path";
import crypto5 from "node:crypto";
var UPLOADS_DIR2 = path3.resolve(process.cwd(), "public/videos/uploads");
function ensureUploadsDir() {
  try {
    if (!fs3.existsSync(UPLOADS_DIR2)) {
      fs3.mkdirSync(UPLOADS_DIR2, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}
async function recordVideoInAmbientDb(id, name, publicUrl, isDefault) {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_background_videos (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        video_url   TEXT NOT NULL,
        description TEXT,
        is_default  BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    if (isDefault) {
      await q("UPDATE global_background_videos SET is_default = false");
      await q(
        `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
         VALUES ('default', 'Default Video', $1, now())
         ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
        [publicUrl]
      );
    }
    await q(
      `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, name = EXCLUDED.name, is_default = EXCLUDED.is_default`,
      [id, name, publicUrl, "Uploaded by admin", isDefault]
    );
  } catch (dbErr) {
    console.warn("DB recording for video skipped:", dbErr);
  }
}
async function mediaHandler(req, res) {
  const urlObj = new URL(req.url || "/", "http://localhost");
  const pathname = urlObj.pathname;
  if (req.method === "POST") {
    try {
      const body = await readJsonLarge(req);
      const action = typeof body.action === "string" ? body.action : "upload";
      const filename = typeof body.filename === "string" ? body.filename.trim() : `media_${Date.now()}`;
      const name = typeof body.name === "string" ? body.name.trim() : filename;
      const isDefault = Boolean(body.isDefault);
      const mediaType = typeof body.type === "string" && body.type ? body.type : filename.endsWith(".mp4") ? "video/mp4" : filename.endsWith(".webm") ? "video/webm" : "image/jpeg";
      const kind = mediaType.startsWith("video") || filename.endsWith(".mp4") || filename.endsWith(".webm") ? "video" : "image";
      if (action === "chunk") {
        const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
        const chunkIndex = Number(body.chunkIndex ?? 0);
        const totalChunks = Number(body.totalChunks ?? 1);
        const chunkData = typeof body.chunkData === "string" ? body.chunkData : "";
        if (!uploadId || !chunkData) {
          return sendJson(res, 400, { error: "Missing uploadId or chunkData." });
        }
        await saveMediaChunk(uploadId, chunkIndex, chunkData);
        const isLastChunk = Boolean(body.finalize) || chunkIndex + 1 >= totalChunks;
        if (!isLastChunk) {
          return sendJson(res, 200, {
            ok: true,
            chunkIndex,
            totalChunks,
            complete: false
          });
        }
        const assembled = await assembleMediaChunks(uploadId, mediaType, kind);
        const publicUrl2 = `/api/media/${assembled.id}`;
        if (kind === "video") {
          await recordVideoInAmbientDb(`bg_vid_${assembled.id}`, name, publicUrl2, isDefault);
        }
        return sendJson(res, 201, {
          ok: true,
          complete: true,
          id: assembled.id,
          url: publicUrl2,
          name,
          size: assembled.size,
          isDefault
        });
      }
      const dataStr = typeof body.data === "string" ? body.data.trim() : "";
      if (!dataStr) {
        return sendJson(res, 400, { error: "No media data provided." });
      }
      if (dataStr.startsWith("http://") || dataStr.startsWith("https://") || dataStr.startsWith("/api/media/")) {
        const cleanUrl = dataStr.replace(/^https?:\/\/localhost(:\d+)?/, "");
        return sendJson(res, 200, {
          ok: true,
          id: path3.basename(cleanUrl),
          url: cleanUrl,
          name,
          size: 0,
          isDefault
        });
      }
      const base64Data = dataStr.includes("base64,") ? dataStr.split("base64,")[1] : dataStr;
      const buffer = Buffer.from(base64Data, "base64");
      let ext = path3.extname(filename).toLowerCase();
      if (!ext) {
        if (mediaType.includes("mp4")) ext = ".mp4";
        else if (mediaType.includes("webm")) ext = ".webm";
        else if (mediaType.includes("png")) ext = ".png";
        else ext = ".jpg";
      }
      const safeId = `media_${kind}_${Date.now()}_${crypto5.randomBytes(4).toString("hex")}`;
      const safeFilename = `${safeId}${ext}`;
      const saved = await saveInlineMedia(
        `data:${mediaType};base64,${base64Data}`,
        kind,
        safeId
      );
      const publicUrl = `/api/media/${saved.id}`;
      if (ensureUploadsDir()) {
        try {
          fs3.writeFileSync(path3.join(UPLOADS_DIR2, safeFilename), buffer);
        } catch {
        }
      }
      if (kind === "video") {
        await recordVideoInAmbientDb(`bg_vid_${saved.id}`, name, publicUrl, isDefault);
      }
      return sendJson(res, 201, {
        ok: true,
        id: saved.id,
        url: publicUrl,
        name,
        size: buffer.length,
        isDefault
      });
    } catch (err) {
      console.error("Media upload error:", err);
      return sendJson(res, 500, { error: err.message || "Failed to upload media." });
    }
  }
  if (req.method === "GET" || req.method === "HEAD") {
    const fileParam = urlObj.searchParams.get("file") || pathname.replace(/^\/api\/media\/?/, "");
    if (!fileParam) {
      return sendJson(res, 400, { error: "Missing file parameter" });
    }
    const cleanId = decodeURIComponent(fileParam).replace(/\.[^/.]+$/, "");
    try {
      const row = await getInlineMedia(fileParam) || await getInlineMedia(cleanId);
      if (row && row.data_url) {
        const base64 = String(row.data_url).includes(",") ? String(row.data_url).split(",")[1] : String(row.data_url);
        const buffer2 = Buffer.from(base64, "base64");
        streamBufferWithRange(req, res, buffer2, row.mime_type || "application/octet-stream");
        return;
      }
    } catch (err) {
      console.warn("DB media lookup fallback:", err);
    }
    const safeFilename = path3.basename(fileParam);
    let filePath = path3.join(UPLOADS_DIR2, safeFilename);
    if (!fs3.existsSync(filePath)) {
      const publicVideosPath = path3.resolve(process.cwd(), "public/videos", safeFilename);
      if (fs3.existsSync(publicVideosPath)) {
        filePath = publicVideosPath;
      } else {
        return sendJson(res, 404, { error: "File not found" });
      }
    }
    const buffer = fs3.readFileSync(filePath);
    const ext = path3.extname(safeFilename).toLowerCase();
    const contentType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : ext === ".png" ? "image/png" : "image/jpeg";
    streamBufferWithRange(req, res, buffer, contentType);
    return;
  }
  sendJson(res, 405, { error: "Method not allowed" });
}

// backend/index.ts
init_lib();
var routes = [
  [/^\/api\/auth\/signup$/, signup_default],
  [/^\/api\/auth\/login$/, login_default],
  [/^\/api\/auth\/logout$/, logout_default],
  [/^\/api\/auth\/me$/, me_default],
  [/^\/api\/me\/preferences$/, preferences_default],
  [/^\/api\/me\/reciters$/, reciters_default],
  [/^\/api\/me\/reciters\/[^/]+$/, id_default],
  [/^\/api\/admin\/overview$/, overview_default],
  [/^\/api\/admin\/reciters$/, reciters_default2],
  [/^\/api\/admin\/role$/, role_default],
  [/^\/api\/admin\/ambient$/, ambient_default],
  [/^\/api\/admin\/media$/, media_default],
  [/^\/api\/media\/[^/]+$/, id_default2],
  [/^\/api\/health$/, handler14],
  [/^\/api\/reciters$/, reciters_default3],
  [/^\/api\/ambient$/, ambient_default2],
  [/^\/api\/media(\/.*)?$/, mediaHandler]
];
var handler17 = async (req, res) => {
  const url = (req.url || "").split("?")[0];
  const match = routes.find(([pattern]) => pattern.test(url));
  if (!match) {
    return sendJson(res, 404, { error: "Unknown API route" });
  }
  try {
    await match[1](req, res);
  } catch (err) {
    console.error("[api] Unhandled error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
};
var index_default = handler17;
export {
  index_default as default
};
