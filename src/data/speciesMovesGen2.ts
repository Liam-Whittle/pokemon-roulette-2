export interface SpeciesMovesRow {
  id: number;
  name: string;
  moves: string[];
}

const RAW_ROWS = `
152,Chikorita,Razor Leaf,Reflect,Light Screen,Body Slam
153,Bayleef,Razor Leaf,Reflect,Light Screen,Synthesis
154,Meganium,Razor Leaf,Reflect,Synthesis,Body Slam
155,Cyndaquil,Flamethrower,Swift,Smokescreen,Dig
156,Quilava,Flamethrower,ThunderPunch,Swift,Dig
157,Typhlosion,Flamethrower,ThunderPunch,Earthquake,Sunny Day
158,Totodile,Surf,Crunch,Ice Punch,Slash
159,Croconaw,Surf,Ice Punch,Strength,Crunch
160,Feraligatr,Surf,Earthquake,Ice Punch,Return
161,Sentret,Return,Shadow Ball,Dig,Defense Curl
162,Furret,Return,Shadow Ball,Surf,DynamicPunch
163,Hoothoot,Fly,Hypnosis,Reflect,Night Shade
164,Noctowl,Fly,Hypnosis,Reflect,Night Shade
165,Ledyba,Reflect,Light Screen,Safeguard,Comet Punch
166,Ledian,Reflect,Light Screen,Substitute,Agility
167,Spinarak,Sludge Bomb,Dig,Night Shade,Spider Web
168,Ariados,Sludge Bomb,Giga Drain,Night Shade,Agility
169,Crobat,Wing Attack,Sludge Bomb,Confuse Ray,Steel Wing
170,Chinchou,Surf,Thunderbolt,Confuse Ray,Thunder Wave
171,Lanturn,Surf,Thunderbolt,Confuse Ray,Thunder Wave
172,Pichu,Thunderbolt,Sweet Kiss,Charm,Encore
173,Cleffa,Return,Encore,Sweet Kiss,Sing
174,Igglybuff,Return,Sing,Charm,Defense Curl
175,Togepi,Return,Charm,Encore,Metronome
176,Togetic,Return,Charm,Encore,Fire Blast
177,Natu,Psychic,Giga Drain,Night Shade,Confuse Ray
178,Xatu,Psychic,Fly,Giga Drain,Confuse Ray
179,Mareep,Thunderbolt,Thunder Wave,Light Screen,Headbutt
180,Flaaffy,Thunderbolt,Thunder Wave,Light Screen,Fire Punch
181,Ampharos,Thunderbolt,Fire Punch,Thunder Wave,Light Screen
182,Bellossom,Razor Leaf,Sleep Powder,Stun Spore,Moonlight
183,Marill,Surf,Return,Defense Curl,Rollout
184,Azumarill,Surf,Return,Ice Punch,DynamicPunch
185,Sudowoodo,Rock Tomb,Earthquake,Selfdestruct,Curse
186,Politoed,Surf,Ice Beam,Hypnosis,Earthquake
187,Hoppip,Sleep Powder,Stun Spore,Leech Seed,Mega Drain
188,Skiploom,Sleep Powder,Stun Spore,Leech Seed,Mega Drain
189,Jumpluff,Sleep Powder,Stun Spore,Leech Seed,Mega Drain
190,Aipom,Return,Shadow Ball,Agility,Thunderbolt
191,Sunkern,Giga Drain,Sunny Day,Synthesis,Leech Seed
192,Sunflora,Giga Drain,Sunny Day,SolarBeam,Synthesis
193,Yanma,Wing Attack,Giga Drain,Hypnosis,Double Team
194,Wooper,Surf,Earthquake,Ice Punch,Amnesia
195,Quagsire,Surf,Earthquake,Ice Punch,Curse
196,Espeon,Psychic,Morning Sun,Shadow Ball,Reflect
197,Umbreon,Return,Toxic,Confuse Ray,Moonlight
198,Murkrow,Drill Peck,Faint Attack,Icy Wind,Confuse Ray
199,Slowking,Surf,Psychic,Ice Beam,Rest
200,Misdreavus,Shadow Ball,Thunder,Confuse Ray,Mean Look
201,Unown,Hidden Power,Hidden Power,Hidden Power,Hidden Power
202,Wobbuffet,Counter,Mirror Coat,Encore,Safeguard
203,Girafarig,Psychic,Return,Crunch,Thunderbolt
204,Pineco,Spikes,Rapid Spin,Explosion,Reflect
205,Forretress,Spikes,Rapid Spin,Explosion,Hidden Power Bug
206,Dunsparce,Return,Glare,Headbutt,Earthquake
207,Gligar,Earthquake,Wing Attack,Screech,Quick Attack
208,Steelix,Earthquake,Iron Tail,Rock Tomb,Explosion
209,Snubbull,Return,Shadow Ball,Charm,Thunder Wave
210,Granbull,Return,Shadow Ball,Earthquake,Thunder Wave
211,Qwilfish,Surf,Sludge Bomb,Spikes,Explosion
212,Scizor,Metal Claw,Hidden Power Bug,Swords Dance,Steel Wing
213,Shuckle,Toxic,Wrap,Rest,Encore
214,Heracross,Megahorn,Reversal,Earthquake,Rest
215,Sneasel,Slash,Shadow Ball,Icy Wind,Quick Attack
216,Teddiursa,Return,Earthquake,Rest,Sleep Talk
217,Ursaring,Return,Earthquake,Rest,Sleep Talk
218,Slugma,Flamethrower,Rock Tomb,Body Slam,Recover
219,Magcargo,Flamethrower,Rock Tomb,Earthquake,Recover
220,Swinub,Earthquake,Ice Beam,Rock Tomb,Rest
221,Piloswine,Earthquake,Ice Beam,Rock Tomb,Rest
222,Corsola,Surf,AncientPower,Recover,Mirror Coat
223,Remoraid,Surf,Ice Beam,Psybeam,Octazooka
224,Octillery,Surf,Ice Beam,Psybeam,Octazooka
225,Delibird,Ice Beam,Fly,Quick Attack,Present
226,Mantine,Surf,Ice Beam,Confuse Ray,Rest
227,Skarmory,Drill Peck,Steel Wing,Whirlwind,Rest
228,Houndour,Flamethrower,Crunch,Sunny Day,SolarBeam
229,Houndoom,Flamethrower,Crunch,Sunny Day,SolarBeam
230,Kingdra,Surf,DragonBreath,Ice Beam,Rest
231,Phanpy,Earthquake,Rock Tomb,Body Slam,Defense Curl
232,Donphan,Earthquake,Rock Tomb,Rapid Spin,Rest
233,Porygon2,Return,Thunderbolt,Ice Beam,Recover
234,Stantler,Return,Hypnosis,Earthquake,Light Screen
235,Smeargle,Spore,Spikes,Substitute,Agility
236,Tyrogue,Hi Jump Kick,Mach Punch,Mind Reader,Rapid Spin
237,Hitmontop,Triple Kick,Mach Punch,Rapid Spin,Dig
238,Smoochum,Psychic,Ice Beam,Lovely Kiss,Sweet Kiss
239,Elekid,Thunderbolt,Ice Punch,Fire Punch,Thunder Wave
240,Magby,Flamethrower,ThunderPunch,Confuse Ray,Sunny Day
241,Miltank,Body Slam,Milk Drink,Heal Bell,Earthquake
242,Blissey,Softboiled,Thunder Wave,Ice Beam,Thunderbolt
243,Raikou,Thunderbolt,Hidden Power Ice,Reflect,Rest
244,Entei,Flamethrower,Sunny Day,SolarBeam,Return
245,Suicune,Surf,Ice Beam,Rest,Mirror Coat
246,Larvitar,Rock Tomb,Earthquake,Crunch,Screech
247,Pupitar,Rock Tomb,Earthquake,Crunch,Screech
248,Tyranitar,Rock Tomb,Earthquake,Crunch,Fire Blast
249,Lugia,Aeroblast,Psychic,Recover,Whirlwind
250,Ho-Oh,Sacred Fire,Recover,Earthquake,Thunder
251,Celebi,Psychic,Giga Drain,Recover,Leech Seed
`.trim();

export const CURATED_SPECIES_MOVES_GEN2: Record<number, SpeciesMovesRow> = Object.fromEntries(
  RAW_ROWS.split('\n').map((line) => {
    const parts = line.split(',');
    const id = Number(parts[0].trim());
    const name = parts[1].trim();
    const slots = parts.slice(2, 6).map((x) => x.trim()).filter(Boolean);
    return [
      id,
      {
        id,
        name,
        moves: slots,
      } satisfies SpeciesMovesRow,
    ];
  }),
);
