"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FoodCategory } from "@/lib/foods";

// Emoji policy: the app targets current emoji fonts (iOS 16.4+ and recent
// Android), so modern code points are fine — onion 🧅, garlic 🧄, butter
// 🧈, bell pepper 🫑, beans 🫘, blueberries 🫐, flatbread 🫓, etc. all
// render. (We used to cap at Unicode 11 for ancient Android; that's been
// relaxed because this is a personal tracker used on a modern device.)
export const EMOJI_BY_CATEGORY: Record<FoodCategory, string[]> = {
  protein: [
    "🍗", "🍖", "🥩", "🐟", "🍣", "🦐", "🦀", "🥚", "🍳", "🧀",
    "🥛", "🥣", "🍤", "💪", "🌭", "🍥", "🫘", "🍢",
  ],
  veg: [
    "🥦", "🥬", "🫑", "🌶️", "🥒", "🍅", "🥕", "🌽", "🍆", "🥔",
    "🍄", "🥗", "🥑", "🧅", "🧄", "🫒", "🫛", "🫚", "🫘", "🌿",
  ],
  fruit: [
    "🍎", "🍌", "🍊", "🍓", "🍇", "🥭", "🍍", "🍉", "🥝", "🍑",
    "🍒", "🍐", "🍈", "🍋", "🥥", "🫐",
  ],
  carb: [
    "🍚", "🍞", "🫓", "🥙", "🥣", "🌾", "🍝", "🍜", "🥖", "🥨",
    "🥐", "🌽", "🥔", "🍙", "🍘", "🥯", "🍠", "🍛", "🧇", "🍩",
  ],
  fat: [
    "🥑", "🌰", "🥜", "🧴", "🥥", "🧈", "🫒", "🧀", "🍳", "🍫", "🥛",
  ],
  egg: ["🥚", "🍳"],
  dairy: [
    "🧀", "🥛", "🥣", "🍶", "🧈", "🍦", "🍨", "🐄", "🥥",
  ],
  sauce: [
    "🥫", "🍅", "🌶️", "🍯", "🧂", "🥣", "🌭", "🥜", "🥗", "🍶",
  ],
};

// Drinks / extras that don't fit a single category but should be available
// in the picker grid.
const EXTRA_EMOJIS = [
  "☕", "🍵", "🥤", "🧃", "🍶", "🍷", "🍺",
  "🥃", "💧", "🍯", "🍫", "🍪", "🥞", "🧇",
  "🍰", "🥧", "🍦", "🍨", "🥟", "🍕", "🍔", "🌮", "🥪", "🍟", "🍿",
  // Sauces / condiments + seasoning so they're reachable from the All tab.
  "🧂", "🌶️", "🥫", "🍅",
];

export const ALL_FOOD_EMOJIS = Array.from(
  new Set([...Object.values(EMOJI_BY_CATEGORY).flat(), ...EXTRA_EMOJIS])
);

export function suggestEmoji(
  name: string,
  category?: FoodCategory
): string {
  const n = name.toLowerCase();
  // Order matters — more specific patterns first so "protein shake" hits the
  // whey/💪 mapping before falling through to the generic "shake".
  const map: Array<[RegExp, string]> = [
    [/whey|protein\s*(shake|powder|scoop)|isolate|casein/, "💪"],
    [/chicken|poultry/, "🍗"],
    [/beef|steak|mutton|lamb|pork|bacon|\bham\b|meat/, "🥩"],
    [/fish|salmon|tuna|mackerel|sardine|cod|tilapia/, "🐟"],
    [/sushi|sashimi/, "🍣"],
    [/shrimp|prawn/, "🦐"],
    [/crab|lobster/, "🦀"],
    [/egg/, "🥚"],
    [/yog(h)?urt|curd|dahi|skyr/, "🥣"],
    [/milk|lassi|buttermilk/, "🥛"],
    [/cheese|paneer|halloumi|feta|cheddar|mozzarella|gouda|parmesan/, "🧀"],
    [/tofu|seitan|tempeh|soya?\s*chunk/, "🍥"],
    // Legumes / pulses — beans emoji covers the lot.
    [/lentil|\bdal\b|\bdhal\b|rajma|chickpea|chana|kidney\s*bean|black\s*bean|\bbean|legume|chole/, "🫘"],
    [/banana/, "🍌"],
    [/apple/, "🍎"],
    [/orange|clementine|mandarin/, "🍊"],
    [/strawberr/, "🍓"],
    [/blueberr|blackberr|raspberr|\bberr/, "🫐"],
    [/grape/, "🍇"],
    [/mango/, "🥭"],
    [/pineapple/, "🍍"],
    [/watermelon|melon/, "🍉"],
    [/kiwi/, "🥝"],
    [/peach|apricot|nectarine/, "🍑"],
    [/pear/, "🍐"],
    [/lemon|lime/, "🍋"],
    [/coconut/, "🥥"],
    [/avocado/, "🥑"],
    [/olive/, "🫒"],
    [/tomato/, "🍅"],
    [/broccoli/, "🥦"],
    [/spinach|kale|lettuce|greens|cabbage/, "🥬"],
    [/salad/, "🥗"],
    [/cucumber/, "🥒"],
    // Bell pepper / capsicum gets the real bell-pepper emoji; chilli stays hot.
    [/bell\s*pepper|capsicum/, "🫑"],
    [/chilli|chili|jalapeno|cayenne|pepper/, "🌶️"],
    [/carrot/, "🥕"],
    [/corn|maize/, "🌽"],
    [/sweet\s*potato|yam|shakarkandi/, "🍠"],
    [/potato|aloo/, "🥔"],
    [/mushroom/, "🍄"],
    [/ginger|adrak/, "🫚"],
    [/garlic/, "🧄"],
    [/onion/, "🧅"],
    [/peas?\b|matar/, "🫛"],
    [/rice|biryani|pulao|pulav|fried rice/, "🍚"],
    [/bread|toast/, "🍞"],
    [/bagel/, "🥯"],
    [/roti|chapati|chapathi|naan|tortilla|paratha|flatbread|pita|wrap/, "🫓"],
    [/oats?|oatmeal|muesli|porridge|cereal|granola/, "🥣"],
    [/pasta|spaghetti|macaroni|penne/, "🍝"],
    [/noodle|ramen|maggi|chowmein/, "🍜"],
    [/almond|cashew|walnut|pistachio|\bnuts?\b/, "🌰"],
    [/peanut/, "🥜"],
    [/oil|ghee/, "🧴"],
    [/butter/, "🧈"],
    // Sauces / condiments — keep these ahead of the generic fallbacks.
    [/ketchup|tomato\s*sauce/, "🍅"],
    [/mayo|mayonnaise|aioli/, "🥫"],
    [/soy\s*sauce|tamari|teriyaki/, "🥫"],
    [/bbq|barbe?cue/, "🍯"],
    [/hummus|falafel/, "🧆"],
    [/chutney/, "🥭"],
    [/salsa/, "🍅"],
    [/mustard/, "🌭"],
    [/peri.?peri|piri.?piri/, "🌶️"],
    [/sriracha|tabasco|hot\s*sauce|chilli\s*sauce|chili\s*sauce|sweet\s*chilli/, "🌶️"],
    [/ranch|dressing|vinaigrette|dip|gravy|relish|pesto|sauce|condiment/, "🥫"],
    [/salt|seasoning|spice|masala/, "🧂"],
    [/coffee|espresso|latte|cappuccino|cold\s*brew/, "☕"],
    [/tea|chai|matcha/, "🍵"],
    [/water|h2o/, "💧"],
    [/honey/, "🍯"],
    [/chocolate|cocoa/, "🍫"],
    [/protein\s*bar|bar|snack/, "🍫"],
    [/cookie|biscuit/, "🍪"],
    [/pretzel/, "🥨"],
    [/popcorn/, "🍿"],
    [/pancake|crepe/, "🥞"],
    [/waffle/, "🧇"],
    [/cake|brownie|muffin/, "🍰"],
    [/\bpie\b|tart/, "🥧"],
    [/ice\s*cream|gelato/, "🍨"],
    [/curry|gravy\s*dish|sabzi|sabji/, "🍛"],
    [/soup|stew|broth/, "🍲"],
    [/sandwich|sub\b/, "🥪"],
    [/dumpling|momo|gyoza|dimsum/, "🥟"],
    [/pizza/, "🍕"],
    [/burger/, "🍔"],
    [/taco|burrito|quesadilla/, "🌮"],
    [/fries|chips/, "🍟"],
    [/juice/, "🧃"],
    [/smoothie|shake/, "🥤"],
    [/soda|cola|soft\s*drink/, "🥤"],
    [/beer/, "🍺"],
    [/wine/, "🍷"],
  ];
  for (const [re, e] of map) if (re.test(n)) return e;
  if (category) return EMOJI_BY_CATEGORY[category][0];
  return "🍽";
}

export function EmojiPicker({
  value,
  onChange,
  category,
}: {
  value: string;
  onChange: (emoji: string) => void;
  category?: FoodCategory;
}) {
  const [tab, setTab] = useState<"suggested" | "all">("suggested");

  const suggested = useMemo(() => {
    if (category) return EMOJI_BY_CATEGORY[category];
    return ALL_FOOD_EMOJIS.slice(0, 24);
  }, [category]);

  const list = tab === "suggested" ? suggested : ALL_FOOD_EMOJIS;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/40 text-2xl">
          {value || "🍽"}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 4))}
          maxLength={4}
          placeholder="Type or pick"
          className="h-12 flex-1 rounded-md border border-border/60 bg-card/40 px-3 text-base font-mono"
          aria-label="Emoji"
        />
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("suggested")}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            tab === "suggested"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/60 text-muted-foreground"
          )}
        >
          Suggested
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            tab === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/60 text-muted-foreground"
          )}
        >
          All
        </button>
      </div>
      <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border/40 bg-card/30 p-1.5">
        {list.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onChange(e)}
            className={cn(
              "flex h-8 items-center justify-center rounded text-lg transition-colors hover:bg-muted",
              value === e && "bg-primary/20 ring-1 ring-primary"
            )}
            aria-label={`Pick ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      {/* Photo-as-food-icon is available for custom foods via FoodIconField
          (see components/food-icon.tsx). It processes the image entirely in
          the browser into a tiny square data URL, so nothing is uploaded and
          stored state stays small. */}
    </div>
  );
}
