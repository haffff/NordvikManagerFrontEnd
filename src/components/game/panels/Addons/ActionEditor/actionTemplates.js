// Templates to start a new action from ("New action" → template): the patterns GMs ask
// for most. Each is self-contained and built only from server steps; the steps get their
// ids when the editor loads the action. They follow the sanity example addon
// (Backend DNDOnePlaceManager.Tests/ActionScenarios/sanity), which is tested end to end.

const step = (Type, Label, Data = {}) => ({ Type, Data: { Label, ...Data } });

// Lowers %target%'s HP by %damage%: its card's hp, or a card-less token's Bar 1.
const damageTarget = () => [
  step("RunScript", "Where its HP is", {
    Output: "",
    Script: 'var t = vars.target;\nreturn t.cardId ? { hpOf: t.cardId, hpName: "hp" } : { hpOf: t.id, hpName: "bar1_value" };',
  }),
  step("GetPropertyValue", "Its HP", { ParentId: "%hpOf%", PropertyName: "%hpName%", DefaultValue: "", Output: "hp" }),
  step("RunScript", "New HP", {
    Output: "",
    Script: "var cur = parseInt(vars.hp, 10);\nif (isNaN(cur)) return { hasHp: 0 };\nreturn { hasHp: 1, newHp: String(Math.max(0, cur - (Number(vars.damage) || 0))) };",
  }),
  step("If", "Only when it has HP", {
    Condition: "%hasHp% = 1",
    Then: [step("SetProperty", "HP", { ParentId: "%hpOf%", PropertyName: "%hpName%", PropertyValue: "%newHp%" })],
  }),
];

export const ACTION_TEMPLATES = [
  {
    key: "targets",
    label: "Action on picked targets",
    description: "The player picks up to 3 tokens on the map, then each gets something (e.g. Bless).",
    hook: 0,
    content: [
      step("RequestTargets", "Who it is for", { Max: "3", Message: "Pick up to 3 creatures", Output: "targets" }),
      step("ForEach", "Each target", {
        Collection: "targets", ItemName: "target",
        Do: [step("SetProperty", "Mark it", { ParentId: "%target.id%", PropertyName: "blessed", PropertyValue: "true" })],
      }),
      step("RunScript", "Their names", { Output: "", Script: 'return { names: vars.targets.map(function (t) { return t.name; }).join(", ") };' }),
      step("SendChat", "Announce", { Template: "Text", Title: "Bless", Message: "%playerName%: Bless on %names%" }),
    ],
  },
  {
    key: "area",
    label: "Area effect with GM confirmation",
    description: "The player aims the area on the map (it follows the cursor, the tokens it covers glow); rolls damage for them and asks the GM before applying it.",
    hook: 0,
    content: [
      step("RequestPoint", "Aim", { Message: "Where does it go off?", Shape: "circle", Radius: "4", SnapToGrid: "corner", Output: "point" }),
      step("Find", "Tokens in the area", { What: "tokens", Near: "%point%", Radius: "4", Output: "hit" }),
      step("ShowMarker", "Show the area while the GM decides", { Shape: "circle", X: "%point.x%", Y: "%point.y%", Radius: "4", UntilActionEnds: true }),
      step("RollDice", "Damage", { DiceString: "8d6", OutputVariable: "rolled", SimpleOutput: true, PrintToChat: true, ChatTitle: "%playerName%: Fireball" }),
      step("RunScript", "Who was hit", { Output: "", Script: 'return { hitNames: vars.hit.map(function (t) { return t.name; }).join(", ") || "nobody" };' }),
      step("RequestUserInput", "Ask the GM", {
        UserID: "%gmId%", ShowDialog: true, Options: "yes\nhalf\nno", StopIfCancelled: false, Output: "answer",
        Message: "%playerName%: %rolled% damage to %hitNames%. Apply it?",
      }),
      step("RunScript", "How much", {
        Output: "",
        Script: 'var a = String(vars.answer || "").toLowerCase();\nvar d = Number(vars.rolled) || 0;\nreturn { damage: a === "yes" ? d : a === "half" ? Math.floor(d / 2) : 0 };',
      }),
      step("If", "Apply it", {
        Condition: "%damage% > 0",
        Then: [step("ForEach", "Each token hit", { Collection: "hit", ItemName: "target", Do: damageTarget() })],
      }),
    ],
  },
  {
    key: "randomCard",
    label: "Random card on the map",
    description: "Right-click on the map: places a copy of a random card that has the property 'monster'.",
    hook: 0,
    content: [
      step("Find", "The cards to choose from", { What: "cards", Property: "monster", Output: "pool" }),
      step("RunScript", "How many", { Output: "", Script: "return { poolSize: vars.pool.length };" }),
      step("If", "None to choose from", {
        Condition: "%poolSize% = 0",
        Then: [
          step("SendChat", "Say so", { Template: "Text", Title: "Random card", Player: "%playerId%", Message: "No card has the property 'monster'." }),
          step("Exit", "Stop"),
        ],
      }),
      step("RollDice", "Pick one", { DiceString: "1d%poolSize%", OutputVariable: "pick", SimpleOutput: true }),
      step("RunScript", "The picked card", { Output: "", Script: "return { picked: vars.pool[Number(vars.pick) - 1] };" }),
      step("CreateCard", "A copy of it", { Name: "%picked.name%", TemplateId: "%picked.id%", Output: "copy" }),
      step("DeleteProperty", "The copy isn't one to pick from", { ParentId: "%copy%", PropertyName: "monster" }),
      step("RunClientCommand", "Its token where the map was clicked", {
        Panel: "BattleMap_token", Command: "CreateToken", Player: "%playerId%",
        Data: '{"contextId": "%battleMapId%", "cardId": "%copy%", "position": %position%}',
      }),
    ],
  },
  {
    key: "damageAll",
    label: "Damage every token on the map",
    description: "Every token on the map the player is looking at takes a random amount of damage.",
    hook: 0,
    content: [
      step("Find", "The tokens on this map", { What: "tokens", Output: "tokens" }),
      step("ForEach", "Each token", {
        Collection: "tokens", ItemName: "target",
        Do: [step("RollDice", "Damage", { DiceString: "1d6", OutputVariable: "damage", SimpleOutput: true }), ...damageTarget()],
      }),
    ],
  },
];
