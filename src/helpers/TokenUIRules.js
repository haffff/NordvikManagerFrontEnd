import { create, all } from 'mathjs'

const TokenUIRules = {
    "FromTo": ({targetMin, targetMax, valueMin, valueMax, propTargetMin, propTargetMax, value}) => {
        if ([targetMin, targetMax, valueMin, valueMax, value].some(v => v === undefined || Number.isNaN(v))) {
            console.warn("FromTo rule received undefined or NaN value:", {targetMin, targetMax, valueMin, valueMax, value});
            return 1;
        }

        // guard against zero division
        if (valueMax === valueMin) {
            console.warn("FromTo rule has valueMin equal to valueMax, cannot perform division:", {valueMin, valueMax});
            return 1;
        }

        const resolvedMin = propTargetMin !== undefined ? propTargetMin : targetMin;
        const resolvedMax = propTargetMax !== undefined ? propTargetMax : targetMax;
        return resolvedMin + (resolvedMax - resolvedMin) * ((value - valueMin) / (valueMax - valueMin));
    },
    "Math": (params) => {
        const {operation, ...values} = params;
        const math = create(all)
        const limitedEvaluate = math.evaluate
        
        math.import({
          // most important (hardly any functional impact)
          'import':     function () { throw new Error('Function import is disabled') },
          'createUnit': function () { throw new Error('Function createUnit is disabled') },
          'reviver':    function () { throw new Error('Function reviver is disabled') },
        
          // extra (has functional impact)
          'evaluate':   function () { throw new Error('Function evaluate is disabled') },
          'parse':      function () { throw new Error('Function parse is disabled') },
          'simplify':   function () { throw new Error('Function simplify is disabled') },
          'derivative': function () { throw new Error('Function derivative is disabled') },
          'resolve':    function () { throw new Error('Function resolve is disabled') },
        }, { override: true });


        let result = limitedEvaluate(operation, values);
        return result;
    },
    "Enum": ({value, enumObject}) => {
        return enumObject[value];
    },
    "FromToEnum": ({defaultValue, targetMin, targetMax, valueMin, valueMax, propTargetMin, propTargetMax, value, enumObject}) => {
        //guard against invalid input
        if (value === undefined || enumObject === undefined) {
            console.warn("FromToEnum rule received undefined value:", {value, enumObject});
            return defaultValue;
        }

        //Use FromTo logic to find the correct enum value based on the provided value and enumObject thresholds
        let fromToResult = TokenUIRules.FromTo({targetMin, targetMax, valueMin, valueMax, propTargetMin, propTargetMax, value});

        for (let i = 0; i < enumObject.length; i++) {
            const {min, max , enumValue} = enumObject[i];
            if (fromToResult > min && fromToResult <= max) {
                return enumValue;
            }
        }
        return defaultValue;
    }
};

export default TokenUIRules;