// rounds/absurd.js — subjective prompts ("Select all squares that feel lonely"), judged by a hand-written accepted set per prompt
// (judgeSet: at least one accepted square, and no more wrong squares than right ones) with scripted pass / fail verdicts.
// A run never repeats a prompt (RUN.usedAbsurd). The director guarantees one between slots 3 and 8.
const ABSURD = [
  { l1: 'Select all squares that', big: 'feel lonely', acc: ['sock', 'balloon', 'moon', 'boat', 'rock', 'cactus', 'ghost', 'crown', 'hydrant', 'umbrella', 'toaster'],
    pass: ['Loneliness confirmed. That was oddly human of you.', 'Correct. We have notified the sock\'s family.'], fail: ['Those squares have plenty of friends. Suspicious.', 'Incorrect. That one is in a group chat.'] },
  { l1: 'Select all squares that', big: 'would survive a sneeze', acc: ['rock', 'mountain', 'house', 'robot', 'toaster', 'crown', 'stairs', 'hydrant', 'bus', 'car', 'bone', 'boat', 'moon', 'cactus'],
    pass: ['Sneeze-proof. Bless you, human.', 'Correct. Gesundheit-resistant.'], fail: ['Achoo. Those did not make it.', 'A sneeze would end that square. Tragic.'] },
  { l1: 'Select the square', big: 'the dog is thinking about', dog: true, max: 2, acc: ['bone', 'ball', 'cat', 'sock', 'pizza', 'hydrant', 'duck'],
    pass: ['Correct. He thinks about nothing else.', 'Yes. The dog is relieved you understand him.'], fail: ['The dog has never once thought about that.', 'Wrong. The dog is disappointed but still loves you.'] },
  { l1: 'Select all squares', big: 'you could sit in', acc: ['boat', 'house', 'crown', 'sock', 'bus', 'car', 'pizza', 'toaster', 'umbrella', 'stairs'],
    pass: ['If it fits, you sits. Verified.', 'Sittable. Very human. Humans love sitting.'], fail: ['You cannot sit in that. We checked.', 'Unsittable. Please reconsider your choices.'] },
  { l1: 'Select all squares', big: 'having a bad day', acc: ['hydrant', 'sock', 'pizza', 'umbrella', 'cloud', 'ghost', 'toaster', 'rock', 'bone', 'crosswalk', 'stairs'],
    pass: ['Correct. We will send them a card.', 'Empathy detected. Robots can\'t do that. Right?'], fail: ['Those squares are thriving, actually.', 'Wrong. That one just got promoted.'] },
  { l1: 'Select all squares that', big: 'would make a good hat', acc: ['crown', 'sock', 'boat', 'pizza', 'duck', 'umbrella', 'cat', 'bone', 'cloud', 'balloon'],
    pass: ['Fashion approved. Extremely human.', 'Correct. The duck has agreed to be a hat.'], fail: ['That is not a hat. That is a lifestyle.', 'The HUMANCHECK fashion team says no.'] },
  { l1: 'Select all squares you could', big: 'knock off a table', acc: ['ball', 'toaster', 'crown', 'duck', 'sock', 'pizza', 'bone', 'rock', 'fish', 'balloon', 'robot'],
    pass: ['Gravity confirmed. Very... feline. Accepted anyway.', 'Correct. Everything leaves the table eventually.'], fail: ['Too big for a table. Even for you.', 'That one is bolted down. We checked.'] },
  { l1: 'Select all squares that', big: 'smell like Tuesday', acc: ICONS.filter(k => !['sun', 'moon', 'ghost'].includes(k)),
    pass: ['Correct. Everything smells like Tuesday.', 'Tuesday detected. Disturbingly accurate.'], fail: ['Those smell like a Thursday. Obviously.', 'No. That is a strong Sunday smell.'] },
  { l1: 'Select all squares that are', big: 'secretly a robot', acc: ['robot', 'toaster', 'car', 'bus', 'hydrant', 'trafficlight', 'bicycle', 'umbrella', 'crosswalk'],
    pass: ['Correct. We have alerted the authorities. Not about you.', 'Robots identified. Takes one to know one. (Kidding.)'], fail: ['That one is 100% organic. We checked its receipts.', 'Incorrect. That square has a pulse.'] },
  { l1: 'Select all squares that', big: 'could beat you at chess', acc: ['robot', 'crown', 'cat', 'ghost', 'toaster', 'moon', 'duck', 'house'],
    pass: ['Correct. The duck has a rating of 2400.', 'Accepted. Humility is a very human trait.'], fail: ['You would beat that one. It has no hands.', 'Incorrect. That square thinks the horse moves in a circle.'] },
  { l1: 'Select all squares that are', big: 'avoiding eye contact', acc: ['cat', 'moon', 'ghost', 'duck', 'sock', 'rock', 'cactus', 'house', 'dog', 'stairs'],
    pass: ['Correct. Nobody look at the sock.', 'Awkwardness detected. Deeply human.'], fail: ['That one is staring right at you. Unblinking.', 'Incorrect. That square maintains excellent eye contact.'] },
  { l1: 'Select all squares that', big: 'owe you money', acc: ['dog', 'duck', 'toaster', 'cat', 'robot', 'ghost', 'crown', 'bus', 'pizza', 'balloon'],
    pass: ['Correct. HUMANCHECK will forward the invoice.', 'Debts recorded. Humans never forget a loan.'], fail: ['That square paid you back in March. You forgot.', 'Incorrect. It is YOU who owes that square money.'] },
  { l1: 'Select all squares that', big: 'know your password', acc: ['cat', 'robot', 'toaster', 'ghost', 'dog', 'moon', 'cloud', 'crown', 'fish'],
    pass: ['Correct. Please change it. Not to "fish".', 'Security breach confirmed. Very relatable.'], fail: ['That one has no idea. It cannot read.', 'Incorrect. That square respects your privacy.'] },
  { l1: 'Select all squares that are', big: 'just going through a phase', acc: ['moon', 'cloud', 'balloon', 'ghost', 'crown', 'sun', 'umbrella', 'bicycle', 'sock'],
    pass: ['Correct. They will grow out of it.', 'Accepted. The moon would like some privacy, though.'], fail: ['That one is permanent. Like stairs.', 'Incorrect. That square has been like this for years.'] },
  { l1: 'Select all squares that', big: 'would be awkward at a party', acc: ['cactus', 'ghost', 'toaster', 'robot', 'rock', 'hydrant', 'sock', 'crosswalk', 'stairs', 'trafficlight'],
    pass: ['Correct. They are standing by the snacks, alone.', 'Accepted. HUMANCHECK also leaves parties early.'], fail: ['That one is the life of the party. Ask anyone.', 'Incorrect. That square knows everyone\'s name.'] },
  { l1: 'Select all squares that are', big: 'on their lunch break', acc: ['pizza', 'fish', 'bone', 'duck', 'dog', 'cat', 'bus', 'toaster', 'sun', 'boat'],
    pass: ['Correct. Please do not disturb them until 1 pm.', 'Lunch break confirmed. Extremely human.'], fail: ['That one is working. Very hard. Look at it.', 'Incorrect. That square skipped lunch to finish a report.'] },
  { l1: 'Select all squares you would', big: 'trust with a secret', acc: ['rock', 'mountain', 'tree', 'house', 'sock', 'cat', 'moon', 'stairs', 'cactus', 'boat'],
    pass: ['Correct. The rock has never told anyone anything.', 'Trust established. Your secret is safe. Probably.'], fail: ['That one tells everyone everything. Especially the duck.', 'Incorrect. That square runs a gossip newsletter.'] },
  { l1: 'Select all squares that are', big: 'thinking about fish', acc: ['cat', 'duck', 'boat', 'fish', 'cloud', 'dog', 'umbrella'],
    pass: ['Correct. Everyone is thinking about fish. That was easy.', 'Fish thoughts detected. Same.'], fail: ['That one is thinking about taxes. Sad.', 'Incorrect. That square has never heard of fish.'] },
  { l1: 'Select all squares that are', big: 'older than they look', acc: ['mountain', 'rock', 'moon', 'sun', 'tree', 'ghost', 'stairs', 'crown', 'house', 'cactus'],
    pass: ['Correct. That mountain does not look a day over three billion.', 'Accepted. Excellent skincare, all of them.'], fail: ['That one is brand new. It still has the sticker.', 'Incorrect. That square was made on Tuesday.'] },
];
function judgeSet(sel, acc, max, passL, failL) {
  if (!sel.length) return { pass: false, verdict: 'Selecting nothing is a very robot thing to do.' };
  const hits = sel.filter(i => acc.has(i)).length, wrong = sel.length - hits;
  const pass = hits >= 1 && hits >= wrong && (!max || sel.length <= max);
  const bad = pass ? [] : sel.filter(i => !acc.has(i));
  if (!pass && max && sel.length > max) return { pass: false, verdict: 'The dog can only think about one thing at a time.', wrong: sel };
  return { pass, verdict: pick(pass ? passL : failL), wrong: bad.length ? bad : pass ? [] : sel };
}
const absurdSize = d => d < 0.5 ? 3 : 4;
registerRound({
  id: 'absurd', name: 'Absurd', minD: 0.15, weight: 0.9,
  intro: 'This one needs feelings. I don\'t have those. You go.',
  generate(d, rng, info) {
    const n = absurdSize(d), N = n * n;
    const used = (info.run && info.run.usedAbsurd) || [];
    let pool = ABSURD.filter(a => !used.includes(a.big)); if (!pool.length) { used.length = 0; pool = ABSURD; }
    const a = rng.pick(pool); used.push(a.big);
    const accI = ICONS.filter(k => a.acc.includes(k)), rej = ICONS.filter(k => !a.acc.includes(k) && k !== 'dog');
    const nA = Math.min(accI.length, n === 3 ? rng.int(2, 4) : rng.int(4, 7)), nR = rej.length ? N - nA : 0;
    const list = rng.shuffle(rng.shuffle(accI).slice(0, nA).concat([...Array(nR)].map(() => rng.pick(rej))).concat([...Array(Math.max(0, N - nA - nR))].map(() => rng.pick(accI))));
    const tiles = list.slice(0, N).map(t => ({ icon: t }));
    return { grid: n, tiles, absurd: true, dog: a.dog, full: a.l1 + ' ' + a.big, a,
      acc: tiles.map((t, j) => a.acc.includes(t.icon) ? j : -1).filter(j => j >= 0),
      l1: a.l1, big: a.big, l3: 'Use your best judgment. We will judge it.' };
  },
  parTime: R => R.cols === 3 ? 14 : 20,
  judge(R) {
    return judgeSet(selected(), new Set(R.acc), R.a.max, R.a.pass, R.a.fail);
  },
  progress: R => `${selected().length} selected`,
});
