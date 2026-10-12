// Cryptomnesia page data: palettes and the panel recipe for each page. Shared by the site and the size-measuring script.
(function () {
  // world = [ground, ink, accent, second accent]
  const WORLDS = {
    town: ['#0b0a1c', '#5f5cab', '#b7ff5a', '#ff7a1a'], lamp: ['#0d1218', '#5c6c7e', '#ff7a1a', '#ffe0a0'], kitchen: ['#15120e', '#a39880', '#e3202c', '#9dff5a'],
    shore: ['#04141a', '#2f6f78', '#f1ead6', '#ff5a4d'], woods: ['#060d08', '#35553a', '#ff3344', '#ffc56b'], cellar: ['#120a08', '#6e4534', '#9dff5a', '#ffffff'],
    graves: ['#0e0d09', '#6b6548', '#5ef0ff', '#ff7a1a'],
  };
  // which world a scene is inked in when shown on its own
  const HOME = { cat: 'town', house: 'town', window: 'town', pumpkins: 'lamp', porch: 'lamp', road: 'lamp', skitter: 'kitchen', tv: 'kitchen', cassette: 'kitchen', cards: 'kitchen', tub: 'kitchen',
    clearing: 'woods', turnout: 'shore', birches: 'woods', swing: 'woods', treeline: 'woods', pier: 'shore', lighthouse: 'shore', wrack: 'shore', mainst: 'town', storefront: 'town', gas: 'lamp',
    marsh: 'graves', fen: 'graves', barn: 'graves', field: 'graves', yard: 'woods', well: 'woods', tree: 'woods', sigil: 'cellar',
    stop: 'lamp', phone: 'lamp', ashtray: 'lamp', doors: 'lamp', bus: 'lamp', booth: 'town', cinema: 'town', reel: 'town', reeds: 'graves', willow: 'graves', ferns: 'woods', mound: 'woods', drowned: 'woods', pond: 'woods', oak: 'woods', grove: 'woods', rungs: 'cellar',
    stairs: 'kitchen', hall: 'kitchen', radio: 'kitchen', armchair: 'kitchen', mantel: 'kitchen', ceiling: 'kitchen', gorse: 'shore', spiral: 'shore', lens: 'shore' };
  // [accent, second accent] a scene takes in place of its world's, on its own or as a panel's tint. a tinted panel puts a fifth colour on its page
  const WARM = '#ffc56b', TINT = { cat: ['#2e9d6a'], swing: ['#4f8257'], cards: [null, WARM], armchair: [null, WARM], ceiling: [null, WARM], oak: [null, '#ff7a1a'], cinema: [null, '#e3202c'] };
  const PW = 360, PH = 480;
  // panel: x, y, w, h, scene, crop centre, crop width (1 = whole scene), edge, then extras:
  //   live = animated (default is a still), fall = vignette softness, swap = its light uses the page's second accent, tint = its own [accent, second accent] in place of the page's, st = dither style, fade = where a fizz border stays solid
  const P = (x, y, w, h, s, cx, cy, z, edge, o = {}) => ({ x, y, w, h, s, c: [cx, cy], z, edge, ...o });
  // face: the page's display face, set by the track the reader is on (g = Grenze Gotisch, m = MedievalSharp, p = Pirata One, sparingly)
  // ch: the choices, each [what it says, the page it leads to, what happens on the way]. the third part is told first on the next page, so every arrival follows from the choice that made it. 'start' goes back to the questions
  // back: a page that returns to an earlier one and may show its pictures again
  // text: t, f (j = the page's display face, d = DotGothic16), z = px, x (omit to centre), y, k = colour slot (1 ink, 2 accent, 3 second accent)
  // The book runs in rows: dusk (where the four dispositions start), then four more, each one lamp darker. A choice always leads one row on, so no walk repeats a page and none is shorter than four choices or longer than five. The ends hang off the last two rows.
  const PAGES = {
    // --- dusk. nine lit
    lane: { face: 'm', world: 'lamp', cap: 'The night bus comes down the quarry road at the same minute it always has. You feel it before you hear it, a low note in your back teeth. Every seat is taken. Nobody you ask has ever seen it stop. Nobody you ask likes being asked.',
      ch: [['Put your hand out', 'shelter', 'You put your hand out. Your arm does not want to. It does not slow. The air off it is warm, and smells of a room where somebody has been ill a long time. When it has gone there is a shelter on the verge that was not there before.'],
        ['Let it pass and walk in', 'picture', 'You let it pass, and something in your chest lets go. Main Street is shut, all but the picture house. Your footsteps come back off the shopfronts half a beat late, and there is one more of them than you are making.']],
      panels: [P(0, 0, 360, 330, 'road', 0.5, 0.5, 1, 'vig', { live: 1 })],
      text: [{ t: 'Nine Lamps', f: 'j', z: 48, y: 348, k: 2 }, { t: 'be in by dark.', f: 'd', z: 16, y: 412, k: 1 }] },
    harrow: { face: 'g', world: 'town', cap: 'The Harrow house, on Marrow Street. The porch chair is still rocking. Out back somebody hung the washing, and cut something into the lawn first. Through the side window the set is on, and whoever is watching has not blinked. The skin between your shoulders knows you are being looked at, though nothing here is facing you.',
      ch: [['Try the screen door', 'parlour', 'The screen door is not latched. The handle is damp, as if somebody let go of it a moment ago, and you wipe your palm on your coat without deciding to. You are in the kitchen before you have decided to go in.'],
        ['Knock on the glass', 'shelter', 'You knock. Very slowly, the one in the chair lifts a hand and knocks back, on the arm of the chair, the same three knocks. You feel each one in your own knuckles. Up at the quarry road a telephone starts to ring. When you get there it has stopped.'],
        ['Go round to the yard', 'creek', 'The mark in the lawn goes under the fence and down the bank as a path, the kind bare feet make. It is wet all the way, though it has not rained, and walking it your own feet feel bare. It ends at water.']],
      panels: [P(0, 0, 236, 236, 'house', 0.5, 0.5, 1, 'fizz', { fade: [1, 1] }), P(244, 0, 116, 236, 'porch', 0.3, 0.5, 0.5, 'line', { live: 1, swap: 1 }),
        P(0, 246, 172, 198, 'yard', 0.5, 0.5, 0.86, 'vig'), P(180, 246, 180, 198, 'window', 0.5, 0.5, 0.9, 'fizz', { fade: [1, 1], live: 1, st: 'xim' })],
      text: [{ t: 'do not wave back', f: 'j', z: 24, y: 452, k: 2 }] },
    quay: { face: 'g', world: 'shore', acc2: '#2e9d6a', cap: 'The quay at slack water, when the sea holds its breath. You find you are holding yours. Somebody has drawn the well cover back, and the rim is wet with handprints, all of them going in. There are bottles in the elm again, which means someone is owed. The cat will not come down.',
      ch: [['Look down the well', 'parlour', 'The rungs are greasy, and warmer than they should be. Your stomach goes down ahead of you. A passage, a stair, a trapdoor that opens under a kitchen table. The air that comes down when you lift it has already been breathed.'],
        ['Take a bottle from the tree', 'picture', 'The glass is warm, like something held in a fist, and it fits your hand so well that you feel thanked. Inside is a ticket. ADMIT ONE, tonight’s date. Up on Main Street one building still has its lights on.'],
        ['Follow what the cat is watching', 'creek', 'Something is moving the reeds from underneath, going inland against the water, about as long as a person lying down. You keep level with it. When you slow, it slows, and the hair on your arms lifts toward it.']],
      panels: [P(0, 0, 360, 230, 'shore', 0.5, 0.5, 1, 'vig', { live: 1 }), P(0, 238, 150, 190, 'well', 0.5, 0.5, 0.8, 'line', { live: 1, st: 'scan' }), P(158, 238, 100, 190, 'tree', 0.52, 0.5, 0.53, 'vig', { fall: 0.75, live: 1 }),
        P(266, 238, 94, 120, 'cat', 0.42, 0.55, 0.5, 'line', { live: 1, swap: 1 })],
      text: [{ t: 'the tide', f: 'j', z: 24, x: 266, y: 368, k: 2 }, { t: 'kept one', f: 'j', z: 24, x: 266, y: 394, k: 2 }, { t: 'someone is owed.', f: 'd', z: 16, y: 446, k: 1 }] },
    dunns: { face: 'p', world: 'town', cap: 'Main Street, shut. The dummy in Dunn’s window faced the wall yesterday. Today it faces the street, and somebody has moved its hands. You catch yourself standing the same way. The pumps have been dry for years, and one globe is lit. The picture house changes its letters every Thursday. Nobody has seen who does it.',
      ch: [['Buy a ticket', 'picture', 'Tonight the letters spell your name, with one letter wrong, the way it is wrong on your birth certificate. You feel caught, like a child whose name is read out in class. The paint is still wet. It comes off on your finger the colour of rust, and it is warm.'],
        ['Lift the pump handle', 'creek', 'The pump runs. What comes out is creek water, cold, with weed in it. The smell gets into the back of your throat and stays, sweet and green. The hose goes off behind the garage and down the bank, and you go with it.'],
        ['Try Dunn’s door', 'parlour', 'The bell over Dunn’s door rings. It is not a shop inside. It is a kitchen, still warm from cooking, and it smells so much like being small and looked after that your eyes sting. The door behind you is a back door now.']],
      panels: [P(0, 0, 360, 170, 'mainst', 0.5, 0.48, 1, 'bars', { live: 1 }), P(0, 178, 200, 200, 'storefront', 0.5, 0.5, 1, 'fizz', { fade: [0, 1], live: 1 }),
        P(208, 178, 152, 220, 'gas', 0.56, 0.5, 0.69, 'vig', { swap: 1, live: 1, fall: 0.6 }), P(0, 386, 100, 94, 'cat', 0.42, 0.52, 0.6, 'line', { live: 1 })],
      text: [{ t: 'now showing', f: 'j', z: 24, x: 112, y: 404, k: 1 }, { t: 'you', f: 'j', z: 36, x: 112, y: 430, k: 2 }] },

    // --- eight lit
    shelter: { face: 'm', world: 'lamp', cap: 'The shelter on the quarry road. The timetable has one time on it. The telephone has been off its hook long enough for ivy, and it is still swinging. On the bench a cigarette is burning, a third gone, the end of it wet. You can taste it. Down in the town, eight lamps.',
      ch: [['Put the receiver to your ear', 'deepwood', 'The earpiece is warm against your ear. It is your own voice, older and tired, asking you to go and see to the truck you left running past the birches. You have never owned a truck. Then it says your name the way only your mother did, and your knees go soft. You go.'],
        ['Take the matchbook', 'stagnes', 'A matchbook from St Agnes Mission. Nine matches, none struck. Inside is a pencil map that starts at this bench, and a thumbprint in something that is not pencil, not yet dry. You put your own thumb to it. It fits.'],
        ['Read the timetable', 'strand', 'It is not a bus time. LOW WATER 11.40, and under it, in a child’s pencil: she will be at the end of the pier. Your mouth fills with the taste of salt. The road goes down to the sea and so do you.']],
      panels: [P(0, 0, 360, 210, 'stop', 0.5, 0.52, 1, 'vig', { live: 1 }), P(0, 218, 150, 200, 'phone', 0.5, 0.5, 0.75, 'line', { live: 1 }), P(158, 218, 202, 150, 'ashtray', 0.5, 0.62, 1, 'fizz', { fade: [1, 1], live: 1 })],
      text: [{ t: 'still lit', f: 'j', z: 36, x: 166, y: 376, k: 2 }, { t: 'it is for you.', f: 'd', z: 16, x: 8, y: 432, k: 1 }] },
    parlour: { face: 'm', world: 'kitchen', cap: 'A kitchen. Moonlight on the floor, a stain in it, still tacky, and a mark where something heavy was dragged to the far door. It dragged its heels. Your own heels ache, looking at it. A tape machine is recording. The label has your name on it, in your writing. The middle card is not from any deck.',
      ch: [['Go up the stairs', 'landing', 'You count thirteen stairs going up. Halfway, the banister is warm in one place, the size of a hand, and your hand rests there longer than you mean it to, as if it were being held. You will count twelve coming down, if you come down.'],
        ['Follow the drag mark', 'deepwood', 'It goes across a room you do not look at, where something turns its head to watch you not look. You feel the turn on the side of your face, like heat off an oven door. Then out, into the trees, and there are lights ahead.'],
        ['Play the tape back', 'stagnes', 'A woman reads nine names. You know eight from the stones at St Agnes. She leaves a gap for the ninth, and in it somebody behind her is breathing fast, and you find you are breathing with them. A bell rings on the tape. It is also ringing outside.']],
      panels: [P(0, 0, 220, 190, 'kitchen', 0.5, 0.5, 1, 'fizz', { fade: [0, 0] }), P(228, 0, 132, 190, 'cassette', 0.5, 0.52, 0.72, 'vig', { live: 1, st: 'xim' }),
        P(0, 198, 230, 180, 'cards', 0.5, 0.52, 1, 'fizz', { fade: [0, 1], live: 1, tint: TINT.cards }), P(0, 386, 360, 48, 'skitter', 0.5, 0.53, 1, 'bars', { live: 1 })],
      text: [{ t: 'be kind.', f: 'd', z: 16, x: 242, y: 232, k: 1 }, { t: 'rewind', f: 'j', z: 36, x: 240, y: 256, k: 2 }, { t: 'your name, your hand.', f: 'd', z: 16, y: 448, k: 1 }] },
    picture: { face: 'p', world: 'town', cap: 'The picture house. A ticket is already through the slot, damp at one corner as if it had been held in a mouth. Inside, every seat but one has a coat buttoned over the back of it and nobody in the coat. The dark has a weight, like a hand laid flat on your head. What is showing is a staircase.',
      ch: [['Take the empty seat', 'landing', 'You sit. The seat is warm. Then the staircase is not on a screen. There is carpet under your shoes, and behind you in the dark every coat has leaned a little forward. You feel it the way you feel a crowd go quiet.'],
        ['Leave by the door under the screen', 'strand', 'The door under the screen opens on shingle and the noise of the sea, so loud you feel it on your skin like rain. Behind you there is only a sea wall, with a wet handprint on it, low down, at the height of a child.'],
        ['Go through a coat’s pockets', 'stagnes', 'A matchbook from St Agnes Mission. And the clapper of a handbell, wrapped in a child’s sock, still warm. Holding it you are suddenly so sad you have to sit down. Up the hill a bell with no clapper is ringing.']],
      panels: [P(0, 0, 170, 270, 'booth', 0.5, 0.5, 0.63, 'fizz', { fade: [0, 0], live: 1 }), P(178, 0, 182, 150, 'cinema', 0.5, 0.5, 1, 'line', { live: 1, tint: TINT.cinema }), P(178, 158, 182, 112, 'reel', 0.5, 0.52, 1, 'vig', { live: 1 })],
      text: [{ t: 'admit one', f: 'j', z: 48, y: 296, k: 2 }, { t: 'tonight only. no late seating.', f: 'd', z: 16, y: 362, k: 1 }] },
    creek: { face: 'g', world: 'graves', cap: 'The creek. The air is thick and sweet and you can feel it on your tongue. Something is tied to the rail of the footbridge. Across the water a tyre on a rope is still moving, the way a swing moves just after a child gets off. Far out, something pale crosses at a walk. Only the top of it shows.',
      ch: [['Cross the footbridge', 'deepwood', 'It is a ribbon, with your initials inked on it, tied in the knot you tie. Your fingers know the knot before your eyes do. Over the bridge the path goes in under birches, toward lights where there should be none.'],
        ['Take the boat', 'strand', 'You do not need the oars. Something under the boat keeps pace and now and then bumps the boards, gently, like a dog nosing a hand. You feel each bump come up into your spine. It grounds you on the strand below the light.'],
        ['Climb the bank toward the bell', 'stagnes', 'A bell is going, up the bank, with no rhythm to it, like something being shaken to keep it quiet. It sets your teeth on edge the way a crying baby does. You climb to it through nettles and come out behind St Agnes.']],
      panels: [P(0, 0, 360, 170, 'reeds', 0.5, 0.5, 1, 'vig', { live: 1 }), P(0, 178, 190, 210, 'willow', 0.5, 0.5, 0.9, 'fizz', { fade: [0, 1], live: 1 }),
        P(198, 178, 162, 210, 'swing', 0.52, 0.52, 0.9, 'vig', { live: 1, fall: 0.6, tint: TINT.swing }), P(0, 392, 360, 66, 'fen', 0.5, 0.56, 2.4, 'bars', { live: 1, st: 'scan' })],
      text: [{ t: 'it goes to the sea. so will you.', f: 'd', z: 16, y: 461, k: 1 }] },

    // --- seven
    stagnes: { face: 'g', world: 'graves', cap: 'St Agnes is a barn with a cross nailed to it. A light is walking between the stones with nobody holding it, stopping at each as if to read it. When it stops at the one with no name, your heart misses, like a foot missing a stair. Across the field one house is lit, and the scarecrow is nearer than it should be. Seven lamps.',
      ch: [['Go down the vestry steps', 'under', 'The vestry door opens on steps. The walls are close enough to touch with both elbows, and after a while they give a little when you touch them. Your ears close up, the way they do under water. You stop counting.'],
        ['Cross the field to the lit house', 'den', 'You keep the scarecrow on your left the whole way, and every time you check it is on your left, and nearer. That side of your neck goes cold and stays cold. You are in the front room of the lit house before you have knocked.'],
        ['Wait at the lychgate', 'laststop', 'There is a bus stop sign nailed to the lychgate. You wait. Something large changes down a gear on the hill, and every bird in the yews goes quiet at once, and the quiet presses on your eardrums.'],
        ['Follow the walking light', 'mere', 'You follow it across stubble and in under trees older than the barn. Twice it stops to let you catch up, and both times you feel absurdly grateful. Then it is not there, and you are.']],
      panels: [P(0, 0, 170, 200, 'barn', 0.5, 0.5, 0.85, 'fizz', { fade: [0, 0] }), P(178, 0, 182, 130, 'graves', 0.5, 0.52, 1, 'vig', { live: 1 }), P(178, 138, 182, 62, 'field', 0.45, 0.38, 1, 'bars', { live: 1 }),
        P(0, 208, 190, 190, 'pumpkins', 0.45, 0.6, 0.9, 'fizz', { fade: [0, 1], swap: 1, live: 1 })],
      text: [{ t: 'come home', f: 'j', z: 36, x: 200, y: 232, k: 2 }, { t: 'one stone has', f: 'd', z: 16, x: 202, y: 290, k: 1 }, { t: 'no name yet.', f: 'd', z: 16, x: 202, y: 310, k: 1 }] },
    landing: { face: 'm', world: 'kitchen', cap: 'Upstairs. Nine hooks by the mirror and eight keys. The mirror is a little slow. You lift your hand to be sure, and feel sick when you are. A wireless is counting down from nine with long gaps, and in the gaps something wet. It has got to seven. Up the next flight a door stands ajar on bathroom light.',
      ch: [['Go up to the door', 'den', 'It is not a bathroom. It is a sitting room in some other house. Somebody has only just got up from the chair, and the cushion is still filling back out. The room smells of them. You know the smell and cannot place it, and it makes your chest hurt.'],
        ['Take a key', 'under', 'You take the key next to the empty hook. It is warm, and it has a pulse, or your thumb does. It fits the low door under the stairs, and behind that there are steps going down.'],
        ['Climb out onto the porch roof', 'laststop', 'From the porch roof you can see the bus coming down Marrow Street with its inside lights on. In the mirror behind you somebody is still standing where you stood. You feel them there the way you feel a tooth that has gone. You drop to the lawn.']],
      panels: [P(0, 0, 200, 300, 'stairs', 0.5, 0.5, 0.67, 'fizz', { fade: [0, 0], live: 1 }), P(208, 0, 152, 170, 'hall', 0.5, 0.45, 0.9, 'line', { live: 1 }), P(208, 178, 152, 122, 'radio', 0.5, 0.5, 1, 'vig', { live: 1 })],
      text: [{ t: 'seven', f: 'j', z: 48, y: 316, k: 2 }, { t: 'it is in no hurry.', f: 'd', z: 16, y: 384, k: 1 }] },
    deepwood: { face: 'm', world: 'woods', cap: 'Somebody left a truck running with its lamps on a door. There is no house. Just the door, standing in its frame among the trees, and a red light burning somewhere behind it. The engine note sits in your stomach like a second pulse. The birches have been keeping count of you. Under the ferns the mushrooms have come up in a ring, and one of them is lit.',
      ch: [['Open the door', 'den', 'It opens onto carpet. The air that comes out is warm and smells of somebody’s hair, somebody you loved, and for one step you are only glad. When you turn round the door is a front door with a street behind its glass.'],
        ['Get in the truck', 'bluff', 'The seat is warm, and shaped. The wheel is tacky where the hands go, and your hands go there. The track climbs until the trees stop and there is only sky and water ahead, and your stomach lifts as if you had already gone over.'],
        ['Step into the ring', 'under', 'The ground inside the ring is soft. It takes you to the ankle and then the knee, gently, like a mouth being careful. You go down like going down in a lift, with that same small drop behind the navel. The lit one comes with you a while, then does not.'],
        ['Walk on past the door', 'mere', 'You leave the door shut. Behind you the handle turns, once, to see if you meant it. You feel it turn in your own wrist. Past the birches the trees are older, and wider, and further apart.']],
      panels: [P(0, 52, 232, 232, 'clearing', 0.5, 0.56, 0.92, 'vig', { live: 1, fall: 0.6 }), P(240, 52, 120, 232, 'birches', 0.56, 0.5, 0.5, 'fizz', { fade: [1, 0], live: 1 }),
        P(96, 276, 250, 200, 'ferns', 0.5, 0.66, 0.92, 'vig', { live: 1, fall: 0.5 })],
      text: [{ t: 'not your door', f: 'j', z: 24, x: 8, y: 12, k: 2 }, { t: 'one is lit.', f: 'd', z: 16, x: 8, y: 372, k: 1 }] },
    strand: { face: 'g', world: 'shore', acc2: '#ff5a4d', cap: 'The strand at low water. The cold comes up through your shoes and you can taste it, like a coin on the tongue. A child’s prints go down to the sea, bare, and do not come back. Somebody dropped a shoe. Every third turn of the light there is a person at the end of the pier.',
      ch: [['Climb the path to the light', 'bluff', 'Halfway up the head you look back. The person on the pier has turned round to watch you climb. They are waving, slowly, and the arm bends in one place too many. Your own elbow aches to see it.'],
        ['Walk out along the pier', 'laststop', 'There is nobody at the end of the pier. There is a bus stop sign, and a wet patch on the boards the shape of two feet. You stand in it before you can stop yourself. It is warm. Out across the sand, something with its inside lights on is driving toward you.'],
        ['Follow the prints', 'under', 'The prints turn along the sea wall to an iron door, open, with steps inside. On the bottom step is the other shoe. It is so small. You pick it up, and you cannot make yourself put it down.']],
      panels: [P(0, 0, 200, 290, 'lighthouse', 0.5, 0.5, 0.69, 'vig', { live: 1, fall: 0.6 }), P(208, 0, 152, 180, 'pier', 0.52, 0.52, 0.84, 'fizz', { fade: [1, 0], live: 1 }),
        P(208, 188, 152, 152, 'wrack', 0.5, 0.5, 1, 'line', { live: 1 })],
      text: [{ t: 'low water', f: 'j', z: 36, x: 8, y: 318, k: 2 }, { t: 'she was told not to.', f: 'd', z: 16, x: 8, y: 370, k: 1 }] },

    // --- six
    under: { face: 'g', world: 'cellar', cap: 'Under the town it is all one cellar, warm, like a bed somebody has just left. The dark down here has a taste, like pennies. Candles stand round a chalked sign, and across it lies a shadow that nothing is casting. Behind a door somebody’s feet go back and forth. When you stop, they stop. Six.',
      ch: [['Blow the candles out', 'dark', 'You blow them out, one, two, three. Each goes with a small sound, like a breath let go, and each time your own chest empties further than you meant. Up in the town, lamps go with them. You climb the shaft by feel, into a street with one lamp left.'],
        ['Stand on the sign', 'bath', 'The shadow that nothing was casting stands up when you step onto it. It is your height. It takes your hand, and its hand is wet, and it walks you up the stair to the door with the light under it.'],
        ['Climb the shaft', 'marrow', 'There are more rungs than there is shaft. Something climbs below you, one rung behind, in no hurry. You can feel its breath on your ankles, and it is not warm. You come out of a coal hole on a street you know.']],
      panels: [P(0, 0, 220, 220, 'sigil', 0.5, 0.55, 0.9, 'line'), P(228, 0, 132, 220, 'rungs', 0.52, 0.48, 0.6, 'vig', { live: 1 }), P(60, 228, 240, 180, 'cellar', 0.5, 0.52, 0.8, 'vig', { live: 1 })],
      text: [{ t: 'the stair you came down is gone.', f: 'd', z: 16, y: 436, k: 1 }] },
    den: { face: 'p', world: 'kitchen', cap: 'A sitting room. The chair is warm, and something has its fingers over the top of the chair back, from behind, resting there. Your scalp tightens, slowly, from the back. Every photograph on the mantel has been turned to the wall but one. A tape sits in the mouth of the recorder. Upstairs the taps are running.',
      ch: [['Hit play on the VCR', 'tape', 'You push the tape home and sit. The chair takes your shape as if it had it already. The fingers do not move. They are just behind your ear, and that ear goes hot, and you can hear your own blood in it.'],
        ['Go up and turn the taps off', 'bath', 'The bathroom is full of steam, and somebody in it is humming the tune you were hummed to sleep with. They know the part you always forgot. Hearing it, you are so tired, all at once, and so glad to be home.'],
        ['Leave by the front door', 'marrow', 'You do not look at the set, and you do not look at the chair. Not looking takes everything you have. Behind you the lock turns, from the inside, slowly, the way you turn one so as not to be heard.'],
        ['Answer the telephone', 'line', 'It is the call box up on the quarry road. It has been ringing since you sat down, and nobody else in the town is going to get it. Each ring pulls at something under your ribs, like a hook. It is still ringing when you get there.']],
      panels: [P(0, 0, 230, 290, 'armchair', 0.5, 0.52, 0.82, 'vig', { live: 1, fall: 0.6, tint: TINT.armchair }), P(238, 0, 122, 140, 'mantel', 0.48, 0.42, 0.8, 'line', { live: 1 }), P(238, 148, 122, 142, 'ceiling', 0.5, 0.45, 0.86, 'fizz', { fade: [1, 1], live: 1, tint: TINT.ceiling })],
      text: [{ t: 'sit down', f: 'j', z: 48, y: 306, k: 2 }, { t: 'she is running it for you.', f: 'd', z: 16, y: 374, k: 1 }] },
    bluff: { face: 'g', world: 'shore', cap: 'The head. The wind goes straight through you, and it smells of matches. A truck stands on the turnout, keys in, engine ticking as it cools. Something is ticking back, from under it, a little slower. The door of the light has the lamp sign on it, and the padlock is hanging open. From up here you can count the lamps. Six.',
      ch: [['Go into the light', 'lightstair', 'The door closes behind you by its own weight, softly, like a hand over a mouth. The cold inside has a sound, very high, at the edge of your hearing. Somewhere above you something ticks as it cools.'],
        ['Drive out of town', 'loop', 'You take the quarry road out, the only road there is. You do not look in the mirror, because something in it is sitting very still. With every yard you feel lighter, and you let yourself believe it. Then the road starts to come down.']],
      panels: [P(0, 0, 360, 190, 'turnout', 0.5, 0.62, 1, 'bars', { live: 1 }), P(40, 198, 280, 230, 'gorse', 0.5, 0.42, 1, 'vig', { live: 1, fall: 0.6 })],
      text: [{ t: 'unlocked', f: 'j', z: 36, y: 432, k: 2 }] },
    laststop: { face: 'm', world: 'lamp', cap: 'It stops. It has never stopped. Your heart stops with it, one long beat. The air that comes out is warm and has been breathed. Nobody is at the wheel. In every window there is a face, side on, holding its breath. The blind says MARROW ST and under it, smaller, your name.',
      ch: [['Get on', 'seat', 'You get on. The step gives under you like something alive. The doors fold shut gently, the way you would shut a door on somebody sleeping, and the gentleness is the worst part.'],
        ['Let it go', 'marrow', 'You stand back. The doors wait longer than is comfortable, then close. Every face in every window turns to watch you not get on. You feel each one land on you, like rain starting. You walk the way it went, since that is the way home.'],
        ['Walk away up Main Street', 'dummy', 'You turn your back on it, and your back crawls. Main Street is dark from end to end except for one shop window, and in it something is standing very straight, making room.']],
      panels: [P(0, 8, 360, 322, 'doors', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.35 })],
      text: [{ t: 'single', f: 'j', z: 48, y: 336, k: 2 }, { t: 'no return.', f: 'd', z: 16, y: 404, k: 1 }] },
    mere: { face: 'g', world: 'woods', cap: 'Older trees. The quiet is thick in your ears, like cotton wool. An avenue nobody planted runs to something small and red, lit, the wrong way up. Beside it lies a pond. In the water somebody is standing on the far bank. On the far bank nobody is. Behind you the bottles in the oak are knocking together, and there is no wind.',
      ch: [['Kneel and look into the pond', 'reflection', 'You kneel where the bank is trodden flat, in the marks other knees have left. They fit. The mud is warm, and the warmth comes up your thighs like being lowered into a bath.'],
        ['Step into the hollow of the oak', 'hollow', 'Up close the hollow is taller than you are, and something keeps it swept. The wood inside is pale and smooth, like the inside of a wrist, and you want, very badly, to lay your cheek against it.'],
        ['Walk the avenue to the red light', 'marrow', 'Something walks the avenue with you, one row of trees over, keeping step. You match your breathing to its footfalls without meaning to. The red thing is a lamp bracket, hung the wrong way up, at the end of a street you know.']],
      panels: [P(0, 0, 256, 256, 'grove', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.5 }), P(150, 214, 210, 210, 'pond', 0.5, 0.52, 1, 'vig', { live: 1, fall: 0.5 })],
      text: [{ t: 'who is', f: 'j', z: 36, x: 16, y: 300, k: 2 }, { t: 'owed', f: 'j', z: 36, x: 16, y: 338, k: 2 }, { t: 'nobody planted it.', f: 'd', z: 16, y: 446, k: 1 }] },

    // --- five
    marrow: { face: 'g', world: 'town', back: 'harrow', cap: 'Marrow Street. Five lamps left, and from here you can see four. The fifth is behind you, close; you can feel it on your neck like a held breath. Every house is dark but one. You know the house. Knowing it sits in your stomach like cold water. The cat on the wall is watching the lamp, not you.',
      ch: [['Stand under the last lamp', 'dark', 'The four you could see go out while you look at them, far one first. In each new dark something is standing. It would only have taken wanting the lamp to stay. You reach for the wanting and there is nothing there, like a step that is not.'],
        ['Go to the lit window', 'bath', 'The window is steamed, and a hand has wiped a clear place in it at the height of a face. Somebody calls down that you are late, and to mind the stain on the third stair. You were always late. The shame of it is as fresh as it ever was.'],
        ['Walk out by the quarry road', 'loop', 'You walk out the way the bus comes in, and you do not look back, not even when the footsteps behind you fall in with yours. Your legs know this hill. They ache in the old places. Then the road starts to come down.'],
        ['Go round to the yard', 'ninth', 'The washing is still out, in the middle of the night. One sheet has the shape of somebody standing behind it. You lift it, and nobody is, and your hands will not stop shaking, and they smell of earth.']],
      panels: [P(0, 0, 360, 220, 'town', 0.5, 0.52, 1, 'bars', { live: 1 }), P(0, 228, 200, 200, 'house', 0.5, 0.5, 1, 'fizz', { fade: [0, 1] }), P(208, 228, 152, 150, 'cat', 0.42, 0.52, 0.8, 'line', { live: 1 })],
      text: [{ t: 'marrow st', f: 'j', z: 36, x: 208, y: 384, k: 2 }, { t: 'you know the house.', f: 'd', z: 16, y: 446, k: 1 }] },
    lightstair: { face: 'm', world: 'shore', cap: 'Inside the light. The stair goes up further than the tower is tall, and looking up it your stomach turns over, like at the top of a swing. The keeper’s log says the same on every line for ninety years: lit. lit. lit. Tonight’s line is written already, in your hand, and it is not finished.',
      ch: [['Climb, and light it', 'keeper', 'You climb until your legs go, and then some more. Your breath tastes of blood. Above you somebody else is climbing, at your pace, never any nearer. On the sill of the lamp room is a box of nine matches. The first one takes.'],
        ['Leave it dark', 'dark', 'You pull the door to. Something inside comes down the stair, fast, and stops just behind it. You feel it stop, in your teeth. From the head you watch the lamps go out in order, like someone walking home and switching off behind them.']],
      panels: [P(30, 12, 300, 300, 'spiral', 0.5, 0.48, 1, 'vig', { live: 1, fall: 0.4 })],
      text: [{ t: 'lit. lit. lit.', f: 'd', z: 16, y: 326, k: 1 }, { t: 'tonight', f: 'j', z: 48, y: 352, k: 2 }] },

    // --- the ends. each says so. again = what is said first when the questions come round after it
    dark: { face: 'g', world: 'lamp', acc2: '#2e9d6a', end: 1, again: 'There is a field. Then there is a street again, and somebody is asking you something.',
      cap: 'You let the last one go out. The dark is not empty. It comes in close, and it is warm, and it knows where your mouth is. You are not afraid. That is the part you will not be able to forgive. In the morning there is a field where the town was. In your pocket is a matchbook with nine strikes gone. You walk until dusk and the field does not end. Nobody is coming, because nobody remembers there was anywhere to come to.\n\nTHE END. You put the town out, and you were in it.', ch: [['Begin again', 'start']],
      panels: [P(90, 76, 180, 180, 'lamp', 0.3, 0.55, 0.8, 'vig', { live: 1, fall: 0.12 }), P(165, 356, 30, 16, 'cat', 0.39, 0.428, 0.12, 'none', { live: 1, swap: 1 })],
      text: [{ t: 'the long dark', f: 'j', z: 36, y: 262, k: 1 }, { t: 'nobody remembers Marrow Street.', f: 'd', z: 16, y: 312, k: 1 }] },
    tape: { face: 'p', world: 'kitchen', end: 1, again: 'The tape rewinds. You have seen this part.',
      cap: 'The tape is of this room, from where you are sitting. On the screen you get up and answer the door. You have not got up. Someone is knocking, and you feel it in your breastbone, like a second heart. What comes in does not show on tape, only the carpet going flat under it, step by step, toward the chair. The you on the screen looks straight out of the set and mouths: do not answer it. The knocking stops. The back of your neck knows first. Behind you, the handle turns.\n\nTHE END. It is a little ahead of you, and it has already happened.', ch: [['Answer it', 'start']],
      panels: [P(50, 30, 260, 260, 'tv', 0.47, 0.5, 0.9, 'vig', { live: 1, st: 'scan', fall: 0.2 })],
      text: [{ t: 'you are still', f: 'j', z: 36, y: 306, k: 2 }, { t: 'watching', f: 'j', z: 36, y: 344, k: 2 }, { t: 'it is a little ahead of you.', f: 'd', z: 16, y: 402, k: 1 }] },
    bath: { face: 'm', world: 'kitchen', end: 2, again: 'Warm water. Then a voice, asking you things, the way you ask a child things to keep it awake.',
      cap: 'Mrs Pell says the water is still warm. She says it in your mother’s voice, and every part of you that was ever a child leans toward it. Underneath you can hear the others saying it with her. There are eight of them, and the water is the colour it is because of them. Something under the surface turns over to make room. Her hand on the back of your neck is very gentle, and it does not let go, and you find, with horror, that you do not want it to.\n\nTHE END. You are the ninth, and the water closes over.', ch: [['Get in', 'start']],
      panels: [P(30, 24, 300, 300, 'tub', 0.5, 0.5, 1, 'line', { live: 1 })],
      text: [{ t: 'it wore her voice', f: 'j', z: 36, y: 340, k: 2 }, { t: 'like a coat', f: 'j', z: 36, y: 378, k: 2 }, { t: 'she ran it for you.', f: 'd', z: 16, y: 436, k: 1 }] },
    seat: { face: 'm', world: 'lamp', end: 1, again: 'The bus goes round. It comes to the top of the quarry road again.',
      cap: 'The one empty seat is warm, and damp, and it fits. Out on the quarry road somebody is standing with a hand out, and every head on the bus comes round. Not to the window. To you. Your face goes hot, as if you had been caught. You know the coat out there. You are wearing it. You try to stand. The seat has you by the backs of the legs, softly, the way your own skin has you, and you cannot find where you stop and it begins.\n\nTHE END. Every seat is taken. One of them is you, for good.', ch: [['Stay in your seat', 'start']],
      panels: [P(20, 16, 320, 300, 'bus', 0.5, 0.48, 1, 'vig', { live: 1, fall: 0.3 })],
      text: [{ t: 'every seat', f: 'j', z: 36, y: 326, k: 2 }, { t: 'is taken', f: 'j', z: 36, y: 364, k: 2 }, { t: 'you kept it warm.', f: 'd', z: 16, y: 424, k: 1 }] },
    loop: { face: 'm', world: 'lamp', end: 1, back: 'lane', again: 'You have answered these before. You answered them differently.',
      cap: 'The road out of town comes down into town. Your stomach knew a full minute before you did. It is dusk, the first one, and your bag is at your feet. It is wet at one corner. You do not look in it. The night bus is coming down at the same minute it always has. One face is turned to the glass this time. It is yours, older, and it has been crying for a long time. It says something slowly, so you can read it. Not again.\n\nTHE END, which is the beginning. You have done this before. You will do it differently. It will not matter.', ch: [['Put your hand out', 'start']],
      panels: [P(0, 50, 360, 240, 'road', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.25 })],
      text: [{ t: 'again', f: 'j', z: 48, y: 300, k: 2 }, { t: 'be in by dark.', f: 'd', z: 16, y: 370, k: 1 }] },
    keeper: { face: 'g', world: 'shore', end: 1, again: 'The beam comes round. It finds you on a street, being asked something.',
      cap: 'The lamp takes. The heat of it tightens the skin of your face. The beam goes out over the town and you count the roofs it touches. On the next turn there is one fewer, and you feel it go out of you too, a small place, like a pulled tooth. It shows you only what it is about to take, and somebody has to stand here and remember them. The hatch is not in the floor any more. Your eyes have stopped closing. Down on the head the cat watches the ninth lamp, which is you.\n\nTHE END. The light does not go out, and neither do you.', ch: [['Keep count', 'start']],
      panels: [P(40, 12, 280, 300, 'lens', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.3 })],
      text: [{ t: 'the ninth lamp', f: 'j', z: 36, y: 322, k: 2 }, { t: 'is you', f: 'j', z: 36, y: 360, k: 2 }, { t: 'keep count.', f: 'd', z: 16, y: 422, k: 1 }] },
    hollow: { face: 'g', world: 'woods', end: 1, again: 'The oak dreams it again, from the start.',
      cap: 'The hollow is warm, and it fits you. The wood gives against your back like a held breath, and you let your own breath go, and it feels like being forgiven. Above you a red bottle has your name scratched in the glass, in a hand that was old before you were born. The bark has started to close. It comes over your feet, then your knees, and it does not stop at your mouth. You can taste it. Sap, and under the sap, milk. There never was a town. There is an oak that dreams of nine lamps, and now and then it needs somebody to dream them with.\n\nTHE END. You were grown for this.', ch: [['Close your eyes', 'start']],
      panels: [P(20, 10, 320, 320, 'oak', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.35, tint: TINT.oak })],
      text: [{ t: 'it keeps', f: 'j', z: 36, y: 336, k: 2 }, { t: 'what it is owed', f: 'j', z: 36, y: 374, k: 2 }, { t: 'there never was a town.', f: 'd', z: 16, y: 434, k: 1 }] },
    reflection: { face: 'm', world: 'woods', end: 1, again: 'It climbs out. It is asked the same three things you were.',
      cap: 'You kneel and look. The face in the water is yours, and it does not move when you move. Its mouth is open wider than yours goes, and your own jaw aches to match it. It has been down there since the night you went in after her. You remember the cold now. You remember deciding to breathe. What has been walking round the town all evening is only what climbed out. Its hands are on the bank, either side of your knees. They are cold right through, and very strong, and it would like its turn.\n\nTHE END. You drowned a long time ago. Something has to go back in.', ch: [['Let it up', 'start']],
      panels: [P(30, 16, 300, 300, 'drowned', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.3 })],
      text: [{ t: 'something pale', f: 'j', z: 36, y: 326, k: 1 }, { t: 'crossed the water', f: 'j', z: 36, y: 364, k: 1 }, { t: 'it was you. it was only ever you.', f: 'd', z: 16, y: 426, k: 1 }] },
    ninth: { face: 'p', world: 'woods', end: 1, back: 'harrow', again: 'You pick up the spade. Somebody is asking you questions. Answer as if you had only just arrived.',
      cap: 'The yard, behind the washing. The ground is soft in one place, the length of a person, and warmer there than anywhere else. The spade has your initials burned into the handle. There is earth under your nails, packed in hard, and your shoulders ache the way they do after digging. You remember it now the way you remember a dream once somebody tells it to you. How light she was. How long it took. The sound you made her stop making. The ninth name on the tape was not yours. It was the one you gave her.\n\nTHE END. You did this tonight, before any of it. You were not arriving. You were leaving.', ch: [['Pick up the spade', 'start']],
      panels: [P(0, 20, 300, 300, 'mound', 0.5, 0.5, 1, 'vig', { live: 1, fall: 0.4 }), P(236, 250, 124, 124, 'window', 0.5, 0.5, 0.9, 'line', { live: 1, st: 'xim' })],
      text: [{ t: 'the ninth name', f: 'j', z: 36, x: 12, y: 340, k: 2 }, { t: 'you dug it yourself.', f: 'd', z: 16, x: 12, y: 404, k: 1 }] },
    dummy: { face: 'p', world: 'town', end: 1, back: 'dunns', again: 'Thursday. Somebody turns you to the glass, and the street asks you something as it goes by.',
      cap: 'Dunn’s window is lit. Two dummies stand in it, turned to the wall, with a gap between them your width, and a third stand with your coat already on it. You step up to see how it looks. That is all it takes. Your jaw sets first, then your fingers, one at a time, each with a small dry click you feel in your teeth. You try to swallow and there is nothing to swallow with. The two beside you have not breathed in years, and you can hear them trying.\n\nTHE END. You cannot blink. You find you do not need to.', ch: [['Hold still', 'start']],
      panels: [P(40, 20, 280, 280, 'storefront', 0.5, 0.5, 1, 'fizz', { fade: [0.5, 0], live: 1 })],
      text: [{ t: 'new in', f: 'j', z: 48, y: 312, k: 2 }, { t: 'the window', f: 'j', z: 36, y: 362, k: 2 }, { t: 'faces the wall on thursdays.', f: 'd', z: 16, y: 424, k: 1 }] },
    line: { face: 'm', world: 'lamp', end: 1, back: 'shelter', again: 'It rings. You answer. Somebody asks.',
      cap: 'The call box is ringing, and you answer it. A voice says hello, hello, and it is yours, younger. You had forgotten you ever sounded that hopeful, and it goes through you like a blade. You know what comes next. You say you left the truck running, out past the birches. You sound older, and tired. You want to say run. Your mouth will not make the shape. The receiver does not come away from your hand. It has grown to the palm, warm, like a scab. There is ivy going in at your cuff.\n\nTHE END. Tomorrow at dusk it will ring, and you will say it again.', ch: [['Hold the line', 'start']],
      panels: [P(60, 10, 240, 320, 'phone', 0.5, 0.5, 0.75, 'vig', { live: 1, fall: 0.3 })],
      text: [{ t: 'it is for you', f: 'j', z: 36, y: 336, k: 2 }, { t: 'it was always you calling.', f: 'd', z: 16, y: 400, k: 1 }] },
  };
  for (const pg of Object.values(PAGES)) pg.kind = pg.end ? `ending · ${pg.end > 1 ? 'hard box' : 'vignette'}` : `${pg.panels.length} panel${pg.panels.length > 1 ? 's' : ''}`;
  // the way in: three questions, each answer leaning toward a disposition, and where each disposition starts
  const sc = (s, edge, h = 160) => ({ w: 160, h, panels: [{ x: 0, y: 0, w: 160, h, s, c: [0.5, 0.5], z: 1, edge, live: 1 }] });
  // three of these are dealt each time, in any order, their answers shuffled
  const QUIZ = [
    { q: 'A set is on in a house you know is empty.', scene: sc('window', 'fizz'), a: [['Watch it from across the street', 'watcher'], ['Knock', 'knocker'], ['Take the long way round', 'stray'], ['Go in and turn it off', 'keeper']] },
    { q: 'Something small runs along the wall. You look at', scene: sc('skitter', 'bars', 80), a: [['where it came from', 'watcher'], ['where it went', 'knocker'], ['the way out', 'stray'], ['the cat, who did not look', 'keeper']] },
    { q: 'Three cards. You may turn one.', scene: sc('cards', 'vig'), a: [['The moon', 'watcher'], ['The one that is not from the deck', 'knocker'], ['None of them', 'stray'], ['The key', 'keeper']] },
    { q: 'A call box is ringing on an empty road.', scene: sc('phone', 'vig'), a: [['Let it ring, and listen', 'watcher'], ['Answer it', 'knocker'], ['Walk faster', 'stray'], ['Count the rings', 'keeper']] },
    { q: 'Somebody has drawn the well cover back.', scene: sc('well', 'line'), a: [['Listen at the edge', 'watcher'], ['Call down', 'knocker'], ['Leave it open and go', 'stray'], ['Put it back', 'keeper']] },
    { q: 'A cigarette is burning in an ashtray. Nobody is here.', scene: sc('ashtray', 'fizz'), a: [['Wait and see who comes back', 'watcher'], ['Take the matchbook', 'knocker'], ['Be gone before they are back', 'stray'], ['Put it out', 'keeper']] },
    { q: 'Pumpkins on a step, for a door that opens on nothing.', scene: sc('pumpkins', 'vig'), a: [['Watch the door', 'watcher'], ['Knock anyway', 'knocker'], ['Cross the road', 'stray'], ['Light the one that has gone out', 'keeper']] },
    { q: 'The last lamp on the street dips, and comes back.', scene: sc('lamp', 'vig'), a: [['Stand where you can see it', 'watcher'], ['Stand under it', 'knocker'], ['Keep to the dark', 'stray'], ['Want it to stay', 'keeper']] },
  ];
  const ENTRIES = {
    watcher: { name: 'The Watcher', where: 'Starts on the quay at slack water, looking at the town from its edge.', bend: 'Your pages hold their odd frame a little longer.', start: 'quay' },
    knocker: { name: 'The Knocker', where: 'Starts at the Harrow house with a hand already raised.', bend: 'More doors open for you. More of them should not.', start: 'harrow' },
    stray: { name: 'The Stray', where: 'Starts on the road in, as the night bus comes down.', bend: 'The cat follows you from the first page.', start: 'lane' },
    keeper: { name: 'The Keeper', where: 'Starts on the shut main street, where the lamps used to be yours.', bend: 'You begin knowing one rule the others have to learn.', start: 'dunns' },
  };
  // every walk from each way in to an end, as lists of page names. the cat is allowed to turn up more than once; nothing else is, unless a page is a return
  const AGAIN = ['cat'];
  const walks = () => {
    const out = [], go = (k, path) => { const p = [...path, k]; if (PAGES[k].end) return out.push(p); for (const [, to] of PAGES[k].ch) go(to, p); };
    for (const e of Object.values(ENTRIES)) go(e.start, []);
    return out;
  };
  // the pictures a walk shows twice without a return to excuse them: [scene, first page, second page]
  const repeats = (path) => {
    const seen = {}, bad = [];
    for (const k of path) for (const pn of new Set(PAGES[k].panels.map((x) => x.s))) {
      if (seen[pn] && !AGAIN.includes(pn) && !(PAGES[k].back && PAGES[PAGES[k].back].panels.some((x) => x.s === pn))) bad.push([pn, seen[pn], k]);
      seen[pn] = seen[pn] || k;
    }
    return bad;
  };
  // the four colours for a page, or for a scene shown on its own
  const pal = (x) => {
    const pg = typeof x === 'object' ? x : null, c = [...WORLDS[pg ? pg.world : HOME[x] || x]];
    if (pg?.acc2) c[3] = pg.acc2;
    if (!pg) (TINT[x] || []).forEach((t, i) => { if (t) c[2 + i] = t; });
    return c;
  };
  const DATA = { WORLDS, HOME, TINT, PAGES, QUIZ, ENTRIES, PW, PH, pal, walks, repeats };
  if (typeof module !== 'undefined') module.exports = DATA; else globalThis.DFDATA = DATA;
})();
