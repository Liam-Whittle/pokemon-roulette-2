export type SpireView =
  | 'select'
  | 'blessing'
  | 'map'
  | 'combat'
  | 'shop'
  | 'rest'
  | 'event'
  | 'treasure'
  | 'rewards'
  | 'victory'
  | 'defeat';

export type CharacterId = 'blaze' | 'tide' | 'bloom';

export type CardKind = 'attack' | 'skill' | 'power';

export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';

export type NodeKind =
  | 'start'
  | 'monster'
  | 'elite'
  | 'event'
  | 'rest'
  | 'shop'
  | 'treasure'
  | 'boss';

export type CombatStatus = 'burn' | 'toxic' | 'vulnerable' | 'weak' | 'frail';

export type EnemyIntentKind =
  | 'attack'
  | 'attackDebuff'
  | 'buff'
  | 'block'
  | 'status'
  | 'heal'
  | 'multiAttack'
  | 'summon'
  | 'buffAlly';

export type EffectOp =
  | {
      op: 'damage';
      amount: number;
      times?: number;
      all?: boolean;
      blockEqualToDamage?: boolean;
      healEqualToDamage?: boolean;
      perOtherZeroCost?: number;
      repeatIfUnblocked?: boolean;
      unblockedBonus?: number;
      extraTimesPerChargeAdded?: boolean;
      plusBlockIfStatus?: CombatStatus;
      ifAnyStatus?: CombatStatus;
      perGardenToken?: number;
    }
  | { op: 'damageIfStatus'; status: CombatStatus; amount: number; heal?: number }
  | { op: 'statusIfStatus'; ifStatus: CombatStatus; status: CombatStatus; stacks: number }
  | { op: 'statusIfX'; min: number; status: CombatStatus; stacks: number }
  | { op: 'block'; amount: number }
  | { op: 'draw'; amount: number; replayZeroCost?: boolean }
  | { op: 'gainEnergy'; amount: number }
  | {
      op: 'status';
      status: CombatStatus;
      stacks: number;
      all?: boolean;
      self?: boolean;
      timesFromX?: boolean;
      plus?: number;
    }
  | { op: 'strength'; amount: number; self?: boolean }
  | { op: 'dexterity'; amount: number }
  | { op: 'applyPower'; power: string; stacks?: number }
  | { op: 'exhaust' }
  | { op: 'discard'; amount: number; then?: EffectOp[]; ifSkill?: EffectOp[] }
  | { op: 'addCharge'; amount: number; kind: 'attack' | 'block' }
  | { op: 'heal'; amount: number }
  | { op: 'healPercent'; percent: number }
  | { op: 'healFull' }
  | { op: 'loseHp'; amount: number }
  | { op: 'clearStatuses' }
  | { op: 'blockTimes'; amount: number; plus?: number }
  | { op: 'addClassPower'; costOverride?: number }
  | { op: 'upgradeCombatRewards' }
  | { op: 'shredBlock'; percent: number }
  | { op: 'freePlay'; mode: 'random' | 'choose' }
  | { op: 'smokeScreen'; percent: number }
  | { op: 'strengthThisTurn'; amount: number }
  | { op: 'gainMaxHp'; amount: number }
  | { op: 'multiplyStatus'; status: CombatStatus; factor: number; all?: boolean }
  | { op: 'focus'; amount: number; thisTurn?: boolean }
  | { op: 'reflect'; percent: number }
  | { op: 'preventDamageAndEndTurn'; nextTurnDamage: number }
  | { op: 'clearEnemyBlock'; all?: boolean }
  | { op: 'addZeroCostFromAnyClass'; mode: 'random' | 'choose' }
  | { op: 'addPetal'; amount: number }
  | { op: 'addSeed'; amount: number }
  | { op: 'discardAny'; thenPer?: EffectOp[]; filter?: string; exhaust?: boolean }
  | { op: 'harvestSeeds'; healPer: number }
  | { op: 'freeNext'; kind: CardKind }
  | { op: 'statusIfNoBlock'; status: CombatStatus; stacks: number }
  | { op: 'toxicIfAlready'; apply: number; already: number | 'double' }
  | { op: 'toxicPerFive'; base: number; perFive: number }
  | { op: 'gainMaxHpIfAttacking'; amount: number; otherwise?: number; exhaust?: boolean }
  | { op: 'playExhaustedPetals'; all?: boolean; blockPerPetal?: number }
  | { op: 'strengthNextTurn'; amount: number }
  | { op: 'blockEqualToStatus'; status: CombatStatus };

export interface CardDef {
  id: string;
  name: string;
  description: string;
  type: string;
  kind: CardKind;
  cost: number;
  rarity: CardRarity;
  character?: CharacterId;
  effects: EffectOp[];
  exhaust?: boolean;
  exhaustOnDiscard?: boolean;
  token?: boolean;
  xCost?: boolean;
  freeIfDiscardedThisTurn?: boolean;
  discardEnergy?: number;
  onDiscard?: EffectOp[];
  target?: 'enemy' | 'all' | 'self';
  upgrade?: Partial<
    Pick<
      CardDef,
      | 'cost'
      | 'exhaust'
      | 'exhaustOnDiscard'
      | 'description'
      | 'effects'
      | 'kind'
      | 'target'
      | 'onDiscard'
      | 'xCost'
      | 'freeIfDiscardedThisTurn'
      | 'discardEnergy'
    >
  >;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  upgraded: boolean;
  replay?: number;
  costOverride?: number;
}

export type RelicHook =
  | { when: 'combatStart'; effects: EffectOp[] }
  | { when: 'turnStart'; effects: EffectOp[] }
  | { when: 'turnEnd'; effects: EffectOp[] }
  | { when: 'turnEndNoBlock'; effects: EffectOp[] }
  | { when: 'onPlay'; kind?: CardKind; oncePerTurn?: boolean; effects: EffectOp[] }
  | { when: 'onExhaust'; effects: EffectOp[] }
  | { when: 'onPotion'; effects: EffectOp[] }
  | { when: 'everyNAttacks'; n: number; effects: EffectOp[] }
  | { when: 'goldBonus'; percent?: number; flat?: number }
  | { when: 'restHealBonus'; amount: number }
  | { when: 'focusSash' }
  | { when: 'energyMax'; amount: number }
  | { when: 'bonusEnergy'; amount: number }
  | { when: 'drawPerTurn'; amount: number }
  | { when: 'bonusIfStatus'; status: CombatStatus; amount: number; sourceType?: string; kind?: CardKind }
  | { when: 'onPickup'; gold: number }
  | { when: 'reduceMultiAttack'; amount: number }
  | { when: 'upgradeOpeningHand' }
  | { when: 'choiceBand' }
  | { when: 'restAny' }
  | { when: 'restPermDex'; maxUses: number }
  | { when: 'restPermStr'; maxUses: number }
  | { when: 'restTrade' };

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  rarity: CardRarity;
  starter?: boolean;
  character?: CharacterId;
  /** PokeAPI item sprite filename. Defaults to `${id}.png`. */
  sprite?: string;
  /** Full sprite URL when the file is not in the PokeAPI items folder. */
  spriteUrl?: string;
  hooks: RelicHook[];
}

export interface PotionDef {
  id: string;
  name: string;
  description: string;
  effects: EffectOp[];
}

export interface EnemyIntentPattern {
  kind: EnemyIntentKind;
  amount: number;
  status?: CombatStatus;
  statusStacks?: number;
  times?: number;
  summonId?: string;
}

export interface EnemyTraits {
  startBlock?: number;
  curlUp?: number;
  thorns?: number;
  explodeOnDeath?: number;
  blockLinksAttack?: boolean;
  enrageOnSkill?: number;
  punishOnPower?: number;
  splitInto?: string[];
  metallicize?: number;
  phaseAtHp?: number;
  phaseIntents?: EnemyIntentPattern[];
  phaseSummonId?: string;
  reviveOnce?: number;
  repeatSummon?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  speciesId: number;
  types: string[];
  hp: number;
  intents: EnemyIntentPattern[];
  traits?: EnemyTraits;
}

export interface EncounterDef {
  id: string;
  enemyIds: string[];
  gold: number;
  kind: 'monster' | 'elite' | 'boss';
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  speciesId: number;
  speciesName: string;
  types: string[];
  maxHp: number;
  title: string;
  description: string;
  starterRelic: string;
  starterDeck: string[];
}

export interface BiomeDef {
  id: string;
  name: string;
  act: 1 | 2 | 3;
  flavor: string;
  normals: string[];
  elites: string[];
  boss: string;
  events: string[];
}

export type EventResult =
  | { type: 'heal'; amount: number }
  | { type: 'damage'; amount: number }
  | { type: 'gold'; amount: number }
  | { type: 'maxHp'; amount: number }
  | { type: 'relic' }
  | { type: 'card'; rarity: CardRarity }
  | { type: 'removeRandom' }
  | { type: 'upgradeRandom'; count: number }
  | { type: 'potion' }
  | { type: 'combo'; results: EventResult[] }
  | {
      type: 'chance';
      chance?: number;
      success: EventResult;
      fail: EventResult;
      successTitle: string;
      successNote: string;
      failTitle: string;
      failNote: string;
    }
  | {
      type: 'chooseCards';
      pick: number;
      offer: number;
      rarity?: Exclude<CardRarity, 'starter'>;
      colorlessOnly?: boolean;
    }
  | { type: 'removeChoose'; count: number }
  | { type: 'tradeRelic' };

export type LootRevealItem = {
  type: 'relic' | 'card' | 'potion';
  id: string;
  name: string;
  description: string;
};

export type AcquireItem =
  | { type: 'card'; card: CardInstance }
  | { type: 'relic'; id: string }
  | { type: 'potion'; id: string };

export type EventFollowup =
  | { kind: 'message'; title: string; body: string }
  | { kind: 'chooseCards'; pick: number; cards: CardInstance[]; selected: string[] }
  | { kind: 'removeCards'; pick: number; selected: string[] }
  | { kind: 'tradeRelic' }
  | { kind: 'lootReveal'; items: LootRevealItem[] };

export type BlessingFollowup = { kind: 'train'; step: 'upgrade' | 'remove' };

export type CombatFxKind =
  | 'hitEnemy'
  | 'hitPlayer'
  | 'blockGain'
  | 'status'
  | 'chargeEvoke'
  | 'surf'
  | 'faint'
  | 'petal'
  | 'flare'
  | 'relicGlow';

export interface CombatFx {
  id: number;
  kind: CombatFxKind;
  targetId?: string;
  amount?: number;
  hp?: number;
  block?: number;
  chargeKind?: 'attack' | 'block';
  speciesId?: number;
  speciesName?: string;
  defId?: string;
  cardId?: string;
  relicId?: string;
  status?: CombatStatus;
}

export interface EventChoice {
  label: string;
  description: string;
  result: EventResult;
}

export interface EventDef {
  id: string;
  name: string;
  text: string;
  choices: EventChoice[];
}

export interface CombatEnemy {
  id: string;
  defId: string;
  name: string;
  types: string[];
  speciesId: number;
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  enrageStrength?: number;
  intent: EnemyIntentPattern;
  extraIntents?: EnemyIntentPattern[];
  intentIndex: number;
  statuses: Partial<Record<CombatStatus, number>>;
  traits?: EnemyTraits;
  curlUpUsed?: boolean;
  revived?: boolean;
  phased?: boolean;
  summoned?: boolean;
  deathResolved?: boolean;
  acted?: boolean;
}

export interface CombatState {
  playerHp: number;
  playerMaxHp: number;
  playerBlock: number;
  playerTypes: string[];
  characterId: CharacterId;
  energy: number;
  energyMax: number;
  drawCount: number;
  strength: number;
  dexterity: number;
  statuses: Partial<Record<CombatStatus, number>>;
  powers: Record<string, number>;
  waterCharges: { attack: number; block: number };
  chargeQueue: Array<'attack' | 'block'>;
  tempFocus: number;
  reflectPercent: number;
  preventAllDamage: boolean;
  pendingSurfDamage: number;
  forceEndTurn: boolean;
  zeroCostPlayed: number;
  chargesAddedThisCombat: number;
  pendingZeroCostOffer: CardInstance[];
  cardSeq: number;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  enemies: CombatEnemy[];
  relics: string[];
  potions: (string | null)[];
  turn: number;
  log: string[];
  pendingDiscard: number;
  pendingOptionalDiscard: boolean;
  optionalDiscardPicks: string[];
  optionalDiscardPer: EffectOp[];
  optionalDiscardFilter: string | null;
  optionalDiscardExhaust: boolean;
  optionalDiscardCardId: string | null;
  discardedThisTurn: number;
  pendingFreePick: number;
  freePlayIds: string[];
  freeNextKind: CardKind | null;
  pendingNextTurnStrength: number;
  discardThen: EffectOp[];
  discardIfSkill: EffectOp[];
  tempStrength: number;
  smokeScreen: number;
  selectedEnemyId: string | null;
  sashUsed: boolean;
  spawnSeq: number;
  upgradeCardRewards: boolean;
  attacksPlayedThisTurn: number;
  powersPlayedThisTurn: number;
  pendingChoiceBand: boolean;
  choiceBandPicks: string[];
  playerTurnClosed: boolean;
  relicsUsedThisTurn: string[];
  activePowers: CardInstance[];
  combatFx: CombatFx[];
  freePickSelected: string | null;
}

export interface MapNode {
  id: string;
  column: number;
  row: number;
  kind: NodeKind;
  nextIds: string[];
}

export interface ActMap {
  act: 1 | 2 | 3;
  biomeId: string;
  nodes: MapNode[];
  startId: string;
  bossId: string;
  bossPool: string[];
}

export interface RewardOffer {
  gold: number;
  cards: CardInstance[];
  relicId?: string;
  potionId?: string;
  source: 'monster' | 'elite' | 'boss' | 'treasure';
  cardPicked: boolean;
  relicTaken: boolean;
  potionTaken: boolean;
}

export interface ShopStock {
  cards: CardInstance[];
  relics: string[];
  potions: string[];
  removalCost: number;
  removed: boolean;
}

export interface SpireRun {
  seed: number;
  rngState: number;
  instanceSeq: number;
  view: SpireView;
  characterId: CharacterId | null;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInstance[];
  relics: string[];
  potions: (string | null)[];
  act: 1 | 2 | 3;
  map: ActMap | null;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  combat: CombatState | null;
  combatResult: 'win' | 'lose' | null;
  pendingRewards: RewardOffer | null;
  shopStock: ShopStock | null;
  currentEventId: string | null;
  blessingIds: BlessingId[];
  activeEncounterId: string | null;
  smithUsed: boolean;
  smithedCardId: string | null;
  restHealUsed: boolean;
  restDexUsed: boolean;
  restStrUsed: boolean;
  hallwayTheme: 1 | 2 | 3 | null;
  permStrength: number;
  permDexterity: number;
  evioliteUses: number;
  megaStoneUses: number;
  restTrade: { givingId: string; choices: string[] } | null;
  eventFollowup: EventFollowup | null;
  blessingFollowup: BlessingFollowup | null;
  lastMonsterEncounterId: string | null;
  lastEliteEncounterId: string | null;
  pendingAcquire: AcquireItem[] | null;
  actRareTaken: boolean;
}

export type CombatOutcome = 'ongoing' | 'win' | 'lose';

export type BlessingId = 'train' | 'gold' | 'potion' | 'card';
