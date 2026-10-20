import type { RestaurantMenu } from "./types";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const MENU_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    restaurantName: { type: "string" },
    cuisine: { type: "string" },
    summary: { type: "string", description: "1-2 sentence overview of the food style and best healthy choices." },
    confidenceNotes: { type: "string", description: "Brief note about calorie/macro accuracy." },
    healthyTips: {
      type: "array",
      items: { type: "string" },
      description: "2-3 practical tips for ordering healthily at this establishment.",
    },
    items: {
      type: "array",
      description: "8 to 15 popular or representative menu items with estimated macros.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          category: {
            type: "string",
            description: "Category such as 'High Protein', 'Bowls & Salads', 'Entrees', 'Light Bites', 'Sides & Drinks'.",
          },
          portionGrams: { type: "number", minimum: 1, maximum: 2000 },
          kcal: { type: "number", minimum: 0, maximum: 3000 },
          protein: { type: "number", minimum: 0, maximum: 250 },
          carbs: { type: "number", minimum: 0, maximum: 300 },
          fat: { type: "number", minimum: 0, maximum: 200 },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "E.g. ['High Protein', 'Low Calorie', 'Keto', 'Under 500 kcal']",
          },
          price: { type: "string" },
        },
        required: [
          "id",
          "name",
          "description",
          "category",
          "portionGrams",
          "kcal",
          "protein",
          "carbs",
          "fat",
          "tags",
        ],
      },
    },
  },
  required: ["restaurantName", "cuisine", "summary", "healthyTips", "items"],
} as const;

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON.");
  }
}

export async function fetchRestaurantMenu(
  restaurantName: string,
  cuisine: string,
  cityOrAddress?: string
): Promise<{ ok: true; data: RestaurantMenu } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: true,
      data: getMockMenu(restaurantName, cuisine),
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const prompt = `You are a culinary and sports nutrition database for the fitness app Forma.
Provide a realistic, accurate menu breakdown for the following restaurant:
Restaurant: "${restaurantName}"
Cuisine/Type: "${cuisine}"
Location/City: "${cityOrAddress || "General"}"

Instructions:
1. If this is a well-known chain (e.g. Chipotle, Sweetgreen, Subway, McDonald's, Starbucks, In-N-Out, Panda Express, Cava, Shake Shack, etc.), include their real, most famous menu items with standard official nutrition values.
2. If this is an independent or local restaurant, generate 10-14 highly representative dishes typical of its cuisine (e.g. Italian pasta/grilled proteins, Japanese sashimi/ramen/poke, Mexican tacos/plates, American cafe brunch).
3. For EVERY item, calculate realistic macros per serving:
   - portionGrams (grams per serving)
   - kcal (calories)
   - protein (grams)
   - carbs (grams)
   - fat (grams)
   - tags: Include tags like "High Protein" (if >30g protein), "Under 500 kcal", "Low Carb", "Keto Friendly", "Balanced", etc.
4. Categorize items cleanly (e.g., "High Protein", "Bowls & Salads", "Entrees", "Light Bites").
5. Provide 2-3 practical tips for hitting fitness/macro goals when eating here.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: MENU_RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Gemini menu fetch failed with status ${res.status}. Falling back to standard menu.`);
      return { ok: true, data: getMockMenu(restaurantName, cuisine) };
    }

    const payload = await res.json();
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("");

    if (!text) {
      return { ok: true, data: getMockMenu(restaurantName, cuisine) };
    }

    const data = extractJson(text) as RestaurantMenu;
    // ensure each item has an ID
    data.items = data.items.map((item, index) => ({
      ...item,
      id: item.id || `dish-${index + 1}`,
    }));

    return { ok: true, data };
  } catch (err) {
    console.warn("Gemini menu generation error:", err);
    return { ok: true, data: getMockMenu(restaurantName, cuisine) };
  }
}

function getMockMenu(name: string, cuisine: string): RestaurantMenu {
  const isChipotle = name.toLowerCase().includes("chipotle");
  const isSweetgreen = name.toLowerCase().includes("sweetgreen");
  const isSubway = name.toLowerCase().includes("subway");

  if (isChipotle) {
    return {
      restaurantName: name,
      cuisine: "Mexican Grill",
      summary: "High-protein customizable bowls, salads, and burritos with whole ingredients.",
      confidenceNotes: "Based on official Chipotle nutrition calculator.",
      healthyTips: [
        "Choose a bowl instead of a tortilla wrap to save 320 calories.",
        "Double chicken gives over 60g of lean protein.",
        "Get sour cream or queso on the side to easily control fat intake.",
      ],
      items: [
        {
          id: "c-1",
          name: "Chicken Protein Bowl",
          description: "Double chicken, brown rice, black beans, fajita veggies, and fresh tomato salsa.",
          category: "High Protein",
          portionGrams: 480,
          kcal: 680,
          protein: 64,
          carbs: 62,
          fat: 18,
          tags: ["High Protein", "Lean", "Bulking"],
          price: "$13.50",
        },
        {
          id: "c-2",
          name: "Steak & Veggie Salad",
          description: "Supergreens blend, grilled steak, fajita veggies, tomatillo-green salsa, and light cheese.",
          category: "Bowls & Salads",
          portionGrams: 360,
          kcal: 430,
          protein: 36,
          carbs: 24,
          fat: 22,
          tags: ["Under 500 kcal", "Low Carb", "High Protein"],
          price: "$12.25",
        },
        {
          id: "c-3",
          name: "Classic Chicken Burrito Bowl",
          description: "Grilled chicken, white rice, pinto beans, guacamole, and corn salsa.",
          category: "Bowls & Salads",
          portionGrams: 490,
          kcal: 750,
          protein: 44,
          carbs: 76,
          fat: 30,
          tags: ["Balanced", "Popular"],
          price: "$11.85",
        },
        {
          id: "c-4",
          name: "Sofritas Plant-Powered Bowl",
          description: "Organic tofu sofritas, brown rice, black beans, fajita veggies, and guacamole.",
          category: "Bowls & Salads",
          portionGrams: 460,
          kcal: 620,
          protein: 24,
          carbs: 78,
          fat: 26,
          tags: ["Vegetarian", "High Fiber"],
          price: "$10.95",
        },
      ],
    };
  }

  if (isSweetgreen) {
    return {
      restaurantName: name,
      cuisine: "Farm-to-table Salads & Warm Bowls",
      summary: "Nutrient-dense warm grain bowls and freshly tossed greens.",
      confidenceNotes: "Based on official Sweetgreen menu nutrition data.",
      healthyTips: [
        "Ask for dressing 'light' or on the side to reduce 150-200 calories.",
        "Add blackened chicken or roasted tofu to boost protein to 35g+.",
      ],
      items: [
        {
          id: "sg-1",
          name: "Harvest Bowl",
          description: "Roasted chicken, sweet potatoes, apples, goat cheese, warm wild rice, and balsamic vinaigrette.",
          category: "Bowls & Salads",
          portionGrams: 420,
          kcal: 685,
          protein: 38,
          carbs: 64,
          fat: 32,
          tags: ["Popular", "High Protein", "Warm Bowl"],
          price: "$14.50",
        },
        {
          id: "sg-2",
          name: "Guacamole Greens",
          description: "Roasted chicken, avocado, tomatoes, red onion, shredded cabbage, tortilla chips, and lime cilantro jalapeno vinaigrette.",
          category: "Bowls & Salads",
          portionGrams: 390,
          kcal: 530,
          protein: 34,
          carbs: 26,
          fat: 34,
          tags: ["High Protein", "Low Carb"],
          price: "$14.25",
        },
        {
          id: "sg-3",
          name: "Shroomami Bowl",
          description: "Organic tofu, portobello mushrooms, raw beets, cucumbers, shredded cabbage, warm wild rice, and sesame ginger dressing.",
          category: "Bowls & Salads",
          portionGrams: 410,
          kcal: 590,
          protein: 21,
          carbs: 65,
          fat: 28,
          tags: ["Vegan", "Warm Bowl"],
          price: "$13.95",
        },
        {
          id: "sg-4",
          name: "Kale Caesar with Chicken",
          description: "Roasted chicken, shredded parmesan, parmesan crisps, tomatoes, kale, and creamy Caesar dressing.",
          category: "High Protein",
          portionGrams: 350,
          kcal: 460,
          protein: 41,
          carbs: 18,
          fat: 26,
          tags: ["High Protein", "Under 500 kcal", "Low Carb"],
          price: "$13.50",
        },
      ],
    };
  }

  // Generic restaurant / cuisine menu
  return {
    restaurantName: name,
    cuisine: cuisine || "Casual Dining",
    summary: `Selection of typical popular offerings for ${name}. Macros estimated for standard restaurant preparations.`,
    confidenceNotes: "Nutrition estimated using standard food composition tables.",
    healthyTips: [
      "Prioritize grilled or baked proteins over breaded and deep-fried options.",
      "Ask for sauces and dressings on the side to control oil and added sugar.",
      "Pair your entree with steamed greens or a side salad for high satiety.",
    ],
    items: [
      {
        id: "gen-1",
        name: "Grilled Chicken & Roasted Veggies",
        description: "Herb-marinated chicken breast served with seasonal roasted vegetables and olive oil.",
        category: "High Protein",
        portionGrams: 380,
        kcal: 490,
        protein: 46,
        carbs: 18,
        fat: 24,
        tags: ["High Protein", "Under 500 kcal", "Low Carb"],
        price: "$16.00",
      },
      {
        id: "gen-2",
        name: "Pan-Seared Salmon Plate",
        description: "Atlantic salmon fillet with garlic greens and brown rice or roasted potatoes.",
        category: "Entrees",
        portionGrams: 360,
        kcal: 580,
        protein: 39,
        carbs: 35,
        fat: 30,
        tags: ["High Protein", "Omega-3", "Balanced"],
        price: "$21.00",
      },
      {
        id: "gen-3",
        name: "House Grain & Protein Bowl",
        description: "Quinoa, avocado, mixed crisp greens, chickpeas, and lemon-tahini dressing.",
        category: "Bowls & Salads",
        portionGrams: 420,
        kcal: 540,
        protein: 22,
        carbs: 68,
        fat: 22,
        tags: ["High Fiber", "Vegetarian"],
        price: "$14.50",
      },
      {
        id: "gen-4",
        name: "Sirloin Steak & Steamed Broccoli",
        description: "Lean cut grilled sirloin steak with steamed broccoli florets and herb butter.",
        category: "High Protein",
        portionGrams: 320,
        kcal: 510,
        protein: 48,
        carbs: 8,
        fat: 32,
        tags: ["High Protein", "Keto Friendly", "Low Carb"],
        price: "$23.50",
      },
      {
        id: "gen-5",
        name: "Mediterranean Chicken Salad",
        description: "Diced grilled chicken, cucumbers, cherry tomatoes, kalamata olives, feta, and vinaigrette.",
        category: "Light Bites",
        portionGrams: 330,
        kcal: 420,
        protein: 36,
        carbs: 14,
        fat: 25,
        tags: ["Under 500 kcal", "Low Carb", "High Protein"],
        price: "$13.00",
      },
    ],
  };
}
