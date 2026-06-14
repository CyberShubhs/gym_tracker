// Per-exercise training guidance shown in the "?" popup (see
// components/training-guide.tsx). Keyed by the exercise ids used in
// DEFAULT_TEMPLATES + DEFAULT_LEG_TEMPLATES (lib/defaults.ts).
//
// Tempo / rest are mode-aware (strength vs hypertrophy): an exercise can
// override them, otherwise the modal falls back to MODE_DEFAULTS for the
// detected intent. Anything without an entry (custom / user leg exercises
// with dynamic ids) falls back to MODE_DEFAULTS too, so the popup never
// breaks.

export type Intent = "strength" | "hypertrophy";

export type ModeTip = {
  // How fast to move the weight — phrased as seconds up / down so it's
  // actionable mid-set.
  tempo: string;
  // How long to rest between working sets.
  rest: string;
};

export type ExerciseGuide = {
  // Primary + assisting muscles the movement trains.
  targets: string;
  // 2–4 short setup / execution cues.
  howTo: string[];
  // One common mistake → the fix.
  mistake: string;
  // Optional per-exercise tempo/rest overrides.
  strength?: ModeTip;
  hypertrophy?: ModeTip;
  // GIF-ready slot. Leave undefined for now; later, drop a file in
  // /public/exercise-form/<id>.gif and set gifSrc to show it inline.
  media?: { gifSrc?: string; poster?: string };
};

// Sensible defaults per training intent. These mirror the original generic
// copy so behaviour never regresses for exercises without specific tempo/rest.
export const MODE_DEFAULTS: Record<Intent, ModeTip> = {
  strength: {
    tempo:
      "Lower ~2 sec under control, brief pause, then drive up explosively with clean form.",
    rest: "2–3 min between working sets so the next set isn't compromised.",
  },
  hypertrophy: {
    tempo:
      "Lower 2–3 sec under control, full range of motion — no bouncing or half reps.",
    rest: "60–90 sec — enough to recover without losing the pump.",
  },
};

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  // ---- Pressing (chest / shoulders / triceps) ----
  bench: {
    targets: "Chest (pecs), front delts, triceps.",
    howTo: [
      "Shoulder blades pinched back and down, slight arch, feet driving into the floor.",
      "Lower the bar to mid-chest under control — touch, don't bounce.",
      "Press up and slightly back so the bar finishes over your shoulders; full lockout.",
    ],
    mistake: "Elbows flaring to 90° — tuck them to ~45–60° to protect the shoulders.",
  },
  "incline-bb": {
    targets: "Upper chest, front delts, triceps.",
    howTo: [
      "Bench at ~30°. Grip just outside shoulder width.",
      "Lower to the upper chest / collarbone line, elbows ~45°.",
      "Press up and slightly back, squeezing the upper chest at the top.",
    ],
    mistake: "Bench set too steep turns it into a shoulder press — keep it ~30°.",
  },
  "incline-db": {
    targets: "Upper chest, front delts, triceps.",
    howTo: [
      "Bench ~30°. Start with dumbbells at the upper chest, wrists stacked over elbows.",
      "Lower until you feel a stretch across the upper chest.",
      "Press up and slightly together; don't clang the bells at the top.",
    ],
    mistake: "Dropping the elbows too low/back — stay where you control the weight, not where it hurts the shoulder.",
  },
  "flat-db-press": {
    targets: "Chest (pecs), front delts, triceps.",
    howTo: [
      "Shoulder blades retracted, feet planted.",
      "Lower the dumbbells to chest level with a stretch, elbows ~45°.",
      "Press up over the chest and squeeze; control the descent.",
    ],
    mistake: "Letting the dumbbells drift over your face — keep them stacked over the mid-chest.",
  },
  "machine-press": {
    targets: "Chest (pecs), front delts, triceps.",
    howTo: [
      "Set the seat so the handles line up with mid-chest.",
      "Press out smoothly to near-lockout, squeezing the chest.",
      "Return slowly until you feel a chest stretch — don't let the stack slam.",
    ],
    mistake: "Seat too high or low changes the angle — line handles up with your nipple line.",
  },
  ohp: {
    targets: "Front + side delts, triceps, upper chest.",
    howTo: [
      "Bar on the front delts, grip just outside shoulders, brace your abs and glutes.",
      "Press straight up, moving your head slightly back then through at lockout.",
      "Finish with the bar over the mid-foot, biceps by the ears.",
    ],
    mistake: "Leaning back and turning it into an incline press — stay tight and vertical.",
  },
  "db-shoulder-press": {
    targets: "Front + side delts, triceps.",
    howTo: [
      "Sit tall, back supported, dumbbells at shoulder height, elbows slightly forward.",
      "Press up and slightly in until they nearly touch overhead.",
      "Lower under control to ear level for a full stretch.",
    ],
    mistake: "Flaring elbows dead-straight out — keep them slightly forward to spare the shoulders.",
  },

  // ---- Side / rear delts ----
  "cable-lateral": {
    targets: "Side delts (medial deltoid) — builds shoulder width.",
    howTo: [
      "Cable set low, handle in the far hand across your body.",
      "Lead with the elbow, raise to just below shoulder height.",
      "Lower slowly, keeping constant tension on the cable.",
    ],
    mistake: "Using the traps and swinging — go lighter and keep the neck relaxed.",
    hypertrophy: { tempo: "1 sec up, brief hold, 2–3 sec down.", rest: "45–75 sec." },
  },
  "lateral-slow": {
    targets: "Side delts (medial deltoid) — the muscle that builds shoulder width.",
    howTo: [
      "Soft elbows, lead with the elbows not the hands.",
      "Raise to just below shoulder height; pause at the top.",
      "Lower slowly under control — resist the weight the whole way down.",
    ],
    mistake: "Swinging / shrugging with the traps — go lighter and keep it strict.",
    hypertrophy: { tempo: "1 sec up, hold 1 sec, 3 sec down (slow tempo).", rest: "45–60 sec." },
  },
  "rear-delt": {
    targets: "Rear delts, upper-back (rhomboids, traps).",
    howTo: [
      "Slight forward lean / chest supported, soft elbows.",
      "Open the arms out and back in an arc, leading with the elbows.",
      "Squeeze the rear delts, then return slowly.",
    ],
    mistake: "Yanking with the mid-back — keep it light and feel the rear delts, not momentum.",
    hypertrophy: { tempo: "1 sec out, squeeze, 2–3 sec back.", rest: "45–60 sec." },
  },
  "rear-delt-pump": {
    targets: "Rear delts + upper-back; great for posture and the V-taper.",
    howTo: [
      "Cables/rope at face height (face pull) or open arms (rear fly).",
      "Pull/open out and back, elbows high, externally rotating at the end.",
      "Pause at peak contraction, return under control.",
    ],
    mistake: "Going too heavy and using the lats — keep tension on the rear delts.",
    hypertrophy: { tempo: "1 sec out, hold 1 sec, 2 sec back.", rest: "45–60 sec." },
  },
  "face-pull": {
    targets: "Rear delts, external rotators, mid-traps — shoulder health + posture.",
    howTo: [
      "Rope at upper-chest/face height, thumbs pointing back.",
      "Pull the rope towards your forehead, elbows high and wide.",
      "End with hands beside your ears, rear delts squeezed; return slowly.",
    ],
    mistake: "Pulling to the chest like a row — aim high, at the face, to hit the rear delts.",
    hypertrophy: { tempo: "1 sec pull, hold 1 sec, 2 sec back.", rest: "45–75 sec." },
  },

  // ---- Triceps ----
  "tricep-dips": {
    targets: "Triceps, lower chest, front delts.",
    howTo: [
      "Start at the top, arms locked, slight forward lean for chest / upright for triceps.",
      "Lower until upper arms are ~parallel to the floor.",
      "Press back to lockout; on assisted, the pad/weight helps you up.",
    ],
    mistake: "Going too deep and stressing the shoulders — stop around parallel.",
  },
  "rope-pushdown": {
    targets: "Triceps (especially the lateral/outer head).",
    howTo: [
      "Elbows pinned to your sides, rope at chest height.",
      "Push down and spread the rope apart at the bottom, full lockout.",
      "Let it return to ~90° under control; keep elbows still.",
    ],
    mistake: "Elbows drifting forward / leaning over it — keep elbows glued to your ribs.",
    hypertrophy: { tempo: "1 sec down, squeeze, 2 sec up.", rest: "45–75 sec." },
  },
  "cable-pushdown": {
    targets: "Triceps (all three heads).",
    howTo: [
      "Bar or rope at chest height, elbows tucked to your sides.",
      "Push down to full lockout, squeezing the triceps.",
      "Control the weight back up to ~90° without moving the elbows.",
    ],
    mistake: "Half-locking at the bottom — finish each rep with arms fully straight.",
    hypertrophy: { tempo: "1 sec down, squeeze, 2 sec up.", rest: "45–75 sec." },
  },
  "oh-tricep-ext": {
    targets: "Triceps (the long head — the meaty inner part).",
    howTo: [
      "Weight/rope overhead, elbows pointing forward and close to your head.",
      "Lower behind your head for a deep stretch on the triceps.",
      "Extend back to lockout without flaring the elbows.",
    ],
    mistake: "Elbows splaying wide — keep them in and pointing forward to load the long head.",
    hypertrophy: { tempo: "2–3 sec lower (stretch), 1 sec up.", rest: "45–75 sec." },
  },

  // ---- Back ----
  "lat-pulldown": {
    targets: "Lats (back width), biceps, rear delts.",
    howTo: [
      "Grip just outside shoulders, chest up, slight lean back.",
      "Drive the elbows down and in, pulling the bar to the upper chest.",
      "Squeeze the lats, then control the bar all the way up to a full stretch.",
    ],
    mistake: "Pulling behind the neck or with the arms only — lead with the elbows to the chest.",
  },
  "wide-pulldown": {
    targets: "Lats — emphasises upper-lat / back width for the V-taper.",
    howTo: [
      "Grip wide, thumbs over the bar, chest up tall.",
      "Pull elbows down toward your sides, bar to the collarbone.",
      "Squeeze, then return slowly to a full overhead stretch.",
    ],
    mistake: "Heaving with the whole body — let the lats do the work, not momentum.",
    hypertrophy: { tempo: "1–2 sec pull, squeeze, 2–3 sec up.", rest: "60–90 sec." },
  },
  "barbell-row": {
    targets: "Mid-back (lats, rhomboids, traps), rear delts, biceps.",
    howTo: [
      "Hinge to ~45°, flat back, bar over mid-foot.",
      "Row the bar to your lower ribs / belly, elbows back.",
      "Squeeze the back, lower under control; keep the torso angle steady.",
    ],
    mistake: "Standing up as you pull (using the lower back) — keep the torso braced and still.",
  },
  "seated-row": {
    targets: "Mid-back (rhomboids, lats), rear delts, biceps.",
    howTo: [
      "Chest up, slight lean forward at the start for a stretch.",
      "Pull the handle to your belly, driving elbows back and squeezing the shoulder blades.",
      "Return slowly to a full stretch, letting the shoulders reach forward.",
    ],
    mistake: "Rowing with momentum/leaning way back — keep the torso fairly upright and controlled.",
    hypertrophy: { tempo: "1 sec pull, hold 1 sec, 2–3 sec back.", rest: "60–90 sec." },
  },
  "chest-supported-row": {
    targets: "Mid-back (rhomboids, lats), rear delts — strict, no lower-back load.",
    howTo: [
      "Chest on the pad, let the arms hang for a full stretch.",
      "Row to the lower ribs, driving elbows back and pinching the blades.",
      "Lower slowly all the way to the stretch.",
    ],
    mistake: "Peeling your chest off the pad to cheat reps — stay pinned to keep it strict.",
    hypertrophy: { tempo: "1 sec pull, squeeze 1 sec, 2–3 sec back.", rest: "60–90 sec." },
  },
  "single-arm-row": {
    targets: "Lats, mid-back, rear delts, biceps — one side at a time.",
    howTo: [
      "Hand and knee on the bench, flat back, dumbbell hanging straight down.",
      "Row to your hip, driving the elbow back and up; squeeze the lat.",
      "Lower under control to a full stretch before the next rep.",
    ],
    mistake: "Rotating the torso to swing the weight up — keep the shoulders square.",
    hypertrophy: { tempo: "1 sec pull, squeeze 1 sec, 2–3 sec down.", rest: "60–90 sec." },
  },

  // ---- Biceps ----
  "barbell-curl": {
    targets: "Biceps (both heads), forearms.",
    howTo: [
      "Stand tall, elbows pinned to your sides, shoulder-width grip.",
      "Curl up by contracting the biceps, keeping elbows fixed.",
      "Lower all the way down under control to a full stretch.",
    ],
    mistake: "Swinging with the hips/shoulders — keep elbows still and let the biceps work.",
  },
  "ez-bar-curl": {
    targets: "Biceps + forearms; the angled bar is easier on the wrists.",
    howTo: [
      "Grip the inner angles, elbows tucked to your sides.",
      "Curl up squeezing the biceps; keep the elbows fixed.",
      "Lower slowly to a full stretch each rep.",
    ],
    mistake: "Using body english — if you have to swing it, drop the weight.",
    hypertrophy: { tempo: "1 sec up, squeeze 1 sec, 2–3 sec down.", rest: "45–75 sec." },
  },
  "hammer-curl": {
    targets: "Biceps + brachialis + forearms (builds arm thickness).",
    howTo: [
      "Neutral grip (palms facing each other), elbows tucked.",
      "Curl up keeping the thumbs up the whole way.",
      "Lower under control to a full stretch.",
    ],
    mistake: "Swinging the dumbbells up — keep it strict, thumbs up, elbows pinned.",
    hypertrophy: { tempo: "1 sec up, squeeze, 2–3 sec down.", rest: "45–75 sec." },
  },
  "hammer-curl-optional": {
    targets: "Biceps + brachialis + forearms (optional arm finisher).",
    howTo: [
      "Neutral grip, elbows tucked to your sides.",
      "Curl up with thumbs up; squeeze at the top.",
      "Lower slowly to a full stretch.",
    ],
    mistake: "Skip it if recovery is poor — this is a finisher, not a priority lift.",
    hypertrophy: { tempo: "1 sec up, squeeze, 2 sec down.", rest: "45–60 sec." },
  },
  "preacher-curl": {
    targets: "Biceps (peak + lower stretch) — strict, no swinging possible.",
    howTo: [
      "Upper arms flat on the pad, armpits over the top.",
      "Curl up squeezing the biceps; don't fully unrack the tension at the top.",
      "Lower slowly to near-straight for a strong stretch — control it.",
    ],
    mistake: "Letting the arms snap straight at the bottom — control the stretch to protect the elbow.",
    hypertrophy: { tempo: "1 sec up, squeeze 1 sec, 2–3 sec down.", rest: "45–75 sec." },
  },
  "cable-curl": {
    targets: "Biceps — constant tension top to bottom.",
    howTo: [
      "Low pulley, elbows pinned to your sides.",
      "Curl up squeezing the biceps; keep elbows fixed.",
      "Lower under control; the cable keeps tension even at the bottom.",
    ],
    mistake: "Elbows drifting forward — keep them locked at your sides for constant tension.",
    hypertrophy: { tempo: "1 sec up, squeeze 1 sec, 2–3 sec down.", rest: "45–75 sec." },
  },

  // ---- Chest isolation ----
  "chest-fly": {
    targets: "Chest (pecs) — stretch and squeeze, minimal triceps.",
    howTo: [
      "Slight bend in the elbows, hold it throughout (don't press).",
      "Open the arms wide for a deep chest stretch.",
      "Bring the handles together in a hugging arc, squeezing the chest.",
    ],
    mistake: "Bending/straightening the elbows (turning it into a press) — keep the elbow angle fixed.",
    hypertrophy: { tempo: "2–3 sec open (stretch), squeeze 1 sec at the top.", rest: "45–75 sec." },
  },

  // ---- Legs / core (canonical Legs day; user leg templates fall back gracefully) ----
  "leg-press": {
    targets: "Quads, glutes, hamstrings.",
    howTo: [
      "Feet shoulder-width on the platform, mid-height, back and hips flat on the pad.",
      "Lower until knees reach ~90° (deeper if your hips can without rounding).",
      "Press through mid-foot to near-lockout — don't slam the knees straight.",
    ],
    mistake: "Letting the hips round/lift off the seat at the bottom — stop before that point.",
    hypertrophy: { tempo: "2–3 sec down, controlled, 1–2 sec up.", rest: "90–120 sec." },
  },
  rdl: {
    targets: "Hamstrings, glutes, lower back (hip hinge).",
    howTo: [
      "Soft knees, bar/dumbbells against the thighs, flat back.",
      "Push the hips back, lowering the weight down the legs until you feel a hamstring stretch.",
      "Drive the hips forward to stand tall, squeezing the glutes.",
    ],
    mistake: "Rounding the lower back or squatting it down — it's a hip hinge, keep the back flat.",
    hypertrophy: { tempo: "2–3 sec down (feel the stretch), 1 sec up.", rest: "90–120 sec." },
  },
  "leg-curl": {
    targets: "Hamstrings.",
    howTo: [
      "Pad just above the heels/ankles, hips pressed into the bench.",
      "Curl the heels toward your glutes, squeezing the hamstrings.",
      "Lower slowly under control — resist the weight all the way.",
    ],
    mistake: "Hips bouncing off the pad to swing the weight — keep them down and go strict.",
    hypertrophy: { tempo: "1 sec up, squeeze 1 sec, 2–3 sec down.", rest: "60–90 sec." },
  },
  "calf-raise": {
    targets: "Calves (gastrocnemius + soleus).",
    howTo: [
      "Balls of the feet on the edge, heels free to drop.",
      "Lower the heels for a deep stretch, then press all the way up onto the toes.",
      "Pause at the top and the bottom — full range each rep.",
    ],
    mistake: "Tiny bouncy reps — use a full stretch-to-squeeze range and slow it down.",
    hypertrophy: { tempo: "1 sec up, hold 1 sec, 2–3 sec down.", rest: "45–75 sec." },
  },
  "hip-thrust": {
    targets: "Glutes, hamstrings.",
    howTo: [
      "Upper back on the bench, bar/pad over the hips, feet flat shoulder-width.",
      "Drive through the heels to lift the hips to a flat-back bridge.",
      "Squeeze the glutes hard at the top, then lower under control.",
    ],
    mistake: "Over-arching the lower back at the top — finish with a posterior tilt, ribs down.",
    hypertrophy: { tempo: "1 sec up, squeeze 1–2 sec, 2 sec down.", rest: "60–90 sec." },
  },
  "hanging-leg-raise": {
    targets: "Abs (especially lower abs), hip flexors.",
    howTo: [
      "Hang from the bar, shoulders active (not dead-hanging).",
      "Raise the knees/legs by curling the pelvis up, not just lifting the legs.",
      "Lower slowly under control — no swinging.",
    ],
    mistake: "Swinging and using momentum — go slower and curl the pelvis to actually hit the abs.",
    hypertrophy: { tempo: "1 sec up, 2–3 sec down, no swing.", rest: "45–60 sec." },
  },
};

// Looks up the guide for an exercise id. Returns undefined when there's no
// entry (custom / dynamic-id exercises) so callers can fall back to
// MODE_DEFAULTS.
export function getExerciseGuide(id: string): ExerciseGuide | undefined {
  return EXERCISE_GUIDES[id];
}
