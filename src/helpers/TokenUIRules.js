import { create, all } from 'mathjs'

const TokenUIRules = {
    "FromTo": ({targetMin, targetMax, valueMin, valueMax, value}) => {
        return targetMin + (targetMax - targetMin) * ((value - valueMin) / (valueMax - valueMin));
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
    "FromToEnum": ({value, defaultValue, enumObject}) => {
        for (let i = 0; i < enumObject.length; i++) {
            const {min, max , enumValue} = enumObject[i];
            if (value > min && value <= max) {
                return enumValue;
            }
        }
        return defaultValue;
    }
};

export default TokenUIRules;