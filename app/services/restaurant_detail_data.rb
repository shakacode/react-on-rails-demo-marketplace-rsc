# frozen_string_literal: true

# Generates rich content for the restaurant detail page (bio, menu, reviews, etc.).
# Each restaurant gets a deterministic body of markdown content seeded by its id,
# so the page is reproducible across requests but varies between restaurants.
#
# This payload is heavy on purpose — it's the comparison baseline for the
# `/restaurant/:id/{ssr,client,rsc}` variants:
#   - SSR/Client variants ship marked + highlight.js + sanitize-html to the
#     browser to render this markdown client-side after hydration.
#   - RSC variant pre-renders all of it server-side and ships only HTML.
class RestaurantDetailData
  CURRENCIES = %w[USD EUR GBP JPY AUD CAD].freeze
  RATES = { 'USD' => 1.0, 'EUR' => 0.92, 'GBP' => 0.79, 'JPY' => 152.0,
            'AUD' => 1.51, 'CAD' => 1.36 }.freeze

  def self.for(restaurant)
    new(restaurant).build
  end

  def initialize(restaurant)
    @restaurant = restaurant
    @rng = Random.new(restaurant.id)
  end

  def build
    {
      restaurant: serialize_restaurant,
      bio: bio_markdown,
      story: story_markdown,
      menu: menu_payload,
      reviews: reviews_payload,
      hours: hours_payload,
      faq: faq_markdown,
      neighborhood: neighborhood_markdown,
      currencies: CURRENCIES,
      currency_rates: RATES,
      stats: stats_payload,
    }
  end

  private

  attr_reader :restaurant, :rng

  def serialize_restaurant
    {
      id: restaurant.id,
      name: restaurant.name,
      cuisine_type: restaurant.cuisine_type,
      city: restaurant.city,
      state: restaurant.state,
      address: restaurant.address,
      phone: restaurant.phone,
      website: restaurant.website,
      image_url: restaurant.image_url,
      latitude: restaurant.latitude.to_f,
      longitude: restaurant.longitude.to_f,
      average_rating: restaurant.average_rating.to_f,
      review_count: restaurant.review_count,
      timezone: restaurant.timezone,
    }
  end

  def bio_markdown
    cuisine = restaurant.cuisine_type
    name = restaurant.name
    city = restaurant.city || 'the city'

    sections = [
      "## About #{name}\n",
      bio_intro(cuisine, city),
      "\n### Our Philosophy\n",
      bio_philosophy(cuisine),
      "\n### Awards & Recognition\n",
      bio_awards,
      "\n### Sourcing & Suppliers\n",
      bio_sourcing(cuisine),
      "\n### A Note from the Chef\n",
      bio_chef_note(name),
    ]
    sections.join("\n")
  end

  def bio_intro(cuisine, city)
    <<~MD
      Welcome to our home of authentic **#{cuisine}** cuisine, nestled in the heart of **#{city}**. For over a decade, we have been serving traditional dishes crafted from recipes passed down through generations, using techniques refined in the kitchens of #{(%w[Tokyo Paris Mumbai Seoul Lima Lisbon Hanoi Athens]).sample(random: rng)}.

      Our menu showcases #{rng.rand(40..80)} signature dishes, each with its own story. Whether you're joining us for a #{(%w[business lunch romantic dinner family celebration weekend brunch]).sample(random: rng)} or a quiet evening, you'll find an atmosphere that feels both familiar and exciting.

      > "The best meal I've had in years. Every detail mattered." — *#{(%w[Eater Bon\ Appétit New\ York\ Times TimeOut Condé\ Nast Local\ Critic]).sample(random: rng)}*
    MD
  end

  def bio_philosophy(cuisine)
    <<~MD
      Three principles guide every plate that leaves our kitchen:

      1. **Seasonality drives the menu.** We rebuild our specials list every Monday morning, after the chef returns from the #{(['farmers market', 'fish auction', 'producer co-op', 'organic collective']).sample(random: rng)}.
      2. **Technique respects tradition, but never copies it.** We honor the canon of #{cuisine} cooking and then push it forward — #{(['fermenting in-house for 90 days', 'butchering whole animals weekly', 'milling our own flour', 'aging cheeses on-site for six months']).sample(random: rng)}.
      3. **Hospitality is invisible when it works.** From your first greeting to the moment the door closes behind you, our team's job is to anticipate, not interrupt.

      We believe in slow service done quickly — a contradiction that takes years to master.
    MD
  end

  def bio_awards
    awards = [
      'Michelin Bib Gourmand',
      'James Beard Semifinalist (Best New Restaurant)',
      'Eater 38 — Best Restaurants',
      'Bon Appétit Hot 10',
      'Wine Spectator Award of Excellence',
      'OpenTable Diners\' Choice',
      "Local Critic's Pick — Top Five #{restaurant.cuisine_type}",
      'Tasting Table Top 50 Nationwide',
    ].sample(rng.rand(3..5), random: rng)

    list = awards.map.with_index do |a, i|
      "- **#{2026 - i}** — #{a}"
    end.join("\n")

    <<~MD
      We are humbled to have been recognized by the following publications and organizations:

      #{list}

      Our team is proud, but we measure success by tomorrow's reservation list, not yesterday's accolades.
    MD
  end

  def bio_sourcing(cuisine)
    suppliers = (1..rng.rand(4..7)).map do |i|
      name = (%w[Greenfield Hilltop Riverwood Cedar\ Creek Maple\ Bend Pine\ Hollow Stonebridge Eastern\ Light]).sample(random: rng)
      kind = (['Farm', 'Fishery', 'Ranch', 'Orchard', 'Dairy', 'Mill']).sample(random: rng)
      since = rng.rand(2002..2018)
      "- **#{name} #{kind}** — #{(['heritage produce', 'sustainable seafood', 'pasture-raised meats', 'stone-fruit varietals', 'grass-fed dairy', 'heirloom grains']).sample(random: rng)} since #{since}"
    end.join("\n")

    <<~MD
      Where ingredients come from is part of how they taste. We work directly with these producers — many of whom you'll find listed on the back of our daily menu:

      #{suppliers}

      A key principle of #{cuisine} cooking is *terroir* — the sense that flavor is rooted in place. We treat our supplier relationships as part of that.

      ```ruby
      # We even share our kitchen-side recipes by request via our website's API:
      Restaurant.find(#{restaurant.id}).recipes.public.published
        .order(created_at: :desc)
        .first(10)
      ```
    MD
  end

  def bio_chef_note(name)
    <<~MD
      When I opened #{name}, I had a simple ambition: to cook food that I would want to eat every night. Some restaurants chase trends. We chase consistency. The chicken on Tuesday should taste like the chicken on Saturday — only different in the small ways the season demands.

      What you'll find on our menu reflects what's exciting in our kitchen this week. What you'll find in your glass reflects a friend's recommendation from #{(['Burgundy', 'Napa', 'Tuscany', 'Niagara', 'Yarra Valley', 'Mendoza']).sample(random: rng)}. What you'll find in our service reflects the standard we hold ourselves to: *if you'd hesitate to bring your mother here, we haven't done our job.*

      — Chef #{(['M. Hayes', 'A. Kim', 'L. Rossi', 'D. Okonkwo', 'C. Chen', 'P. Marlowe', 'S. Bittar']).sample(random: rng)}
    MD
  end

  def story_markdown
    <<~MD
      ### How we started

      Our story began in #{rng.rand(2008..2016)} when two friends — one a #{(['chef', 'sommelier', 'pastry cook', 'forager']).sample(random: rng)} and the other a #{(['restaurateur', 'farmer', 'food writer', 'designer']).sample(random: rng)} — sat at a kitchen table in #{restaurant.city || 'town'} and sketched out what would become #{restaurant.name}.

      Back then, the cuisine scene in #{restaurant.city || 'this neighborhood'} was a different shape. There were #{(["no proper #{restaurant.cuisine_type} restaurants", "three competing #{restaurant.cuisine_type} restaurants", 'one institution and a dozen imitators']).sample(random: rng)}. We saw an opportunity to do something quieter, smaller, and more intentional.

      Our first dining room had #{rng.rand(18..32)} seats and one shared bathroom. Our menu had nine dishes. We changed the menu every two weeks for the first year because we were figuring out who we were.

      ### What changed

      The kitchen has grown — we now have #{rng.rand(8..18)} cooks across two services — but the philosophy has not. Today's menu is still rooted in the spirit of those first nine dishes, the ones we still make slightly differently every season.
    MD
  end

  def menu_payload
    categories = ['Starters', 'Salads & Sides', 'Mains', 'House Specials', 'Pasta & Noodles', 'Dessert', 'Beverages']
    item_count = 80
    items = (1..item_count).map do |i|
      cat = categories[i % categories.size]
      build_menu_item(i, cat)
    end
    { categories: categories, items: items }
  end

  def build_menu_item(idx, category)
    name = menu_item_name(idx, category)
    price = (rng.rand(800..6800) / 100.0).round(2)
    spice = rng.rand(0..3)
    {
      id: idx,
      name: name,
      category: category,
      price_usd: price,
      description: menu_item_description(name, category),
      tags: menu_item_tags(category),
      spice_level: spice,
      calories: rng.rand(180..980),
      prep_minutes: rng.rand(8..35),
      pairings: rng.rand(2..4).times.map { (%w[Sauvignon\ Blanc Pinot\ Noir Riesling Sake Saison Hazy\ IPA Vermouth]).sample(random: rng) },
    }
  end

  def menu_item_name(idx, category)
    base = case category
           when 'Starters'         then ['Charred Octopus', 'Steamed Buns', 'Beet Tartare', 'Crispy Tofu', 'Burrata', 'Smoked Trout', 'Pickled Vegetables', 'Bone Marrow', 'Hand-Cut Tartare', 'Rice Cake Skewers']
           when 'Salads & Sides'   then ['Charred Broccolini', 'Heirloom Tomato', 'Wood-Roasted Peppers', 'Seasonal Greens', 'Smoked Beets', 'Garlic Greens', 'Crispy Potatoes', 'Roasted Carrots', 'Citrus Endive']
           when 'Mains'            then ['Brick-Pressed Chicken', 'Slow-Braised Short Rib', 'Whole Branzino', 'Lamb Sirloin', 'Mushroom Risotto', 'Duck Breast', 'Grilled Sea Bass', 'Pork Belly', 'Roasted Cauliflower Steak']
           when 'House Specials'   then ['The Sunday Feast', 'Chef\'s Tasting (5 course)', 'Whole Roast Suckling', 'Two-Day Brisket', 'Reserve Steak', 'Truffle Pasta', 'Aged Goat Curry', 'Heritage Pork Roast']
           when 'Pasta & Noodles'  then ['Hand-Pulled Noodles', 'Squid Ink Tagliolini', 'Tortellini in Brodo', 'Wide Rice Noodles', 'Cacio e Pepe', 'Cold Soba', 'Beef Pho', 'Lobster Linguine', 'Lamb Pappardelle']
           when 'Dessert'          then ['Olive Oil Cake', 'Burnt Basque Cheesecake', 'Chocolate Pavé', 'Seasonal Sorbet', 'Tres Leches', 'Crème Brûlée', 'Mochi Trio', 'Stone Fruit Crumble', 'Yuzu Tart']
           when 'Beverages'        then ['Natural Wine (glass)', 'House Cocktail', 'Cold-Brew Tea', 'House Lemonade', 'Espresso Martini', 'Negroni', 'Sake Flight', 'Mezcal Smash', 'Aperol Spritz']
           else ['Daily Special', 'Off-Menu Plate']
           end
    suffix = (['', ' (gf)', ' — chef\'s pick', ' [seasonal]', ' (v)', '']).sample(random: rng)
    "#{base[idx % base.size]}#{suffix}"
  end

  def menu_item_description(name, _category)
    paragraphs = []
    paragraphs << <<~MD.strip
      A composition built around **#{(%w[smoke acid heat funk umami sweetness texture]).sample(random: rng)}** and **#{(%w[balance restraint generosity wit memory]).sample(random: rng)}**. Plated with #{(['microgreens', 'shaved radish', 'flowering chive', 'sea salt', 'bonito flakes']).sample(random: rng)} and finished tableside.
    MD

    if rng.rand(2).zero?
      ingredients = (1..rng.rand(3..6)).map { "*#{(%w[fennel-pollen tahini-cream black-garlic miso-butter pickled-shallot heirloom-tomato saffron-aïoli ponzu-emulsion]).sample(random: rng)}*" }
      paragraphs << "Built with: #{ingredients.join(', ')}."
    end

    if name.include?('Chicken') || name.include?('Pork') || name.include?('Lamb') || name.include?('Branzino')
      paragraphs << "**Source:** #{(['Heritage breed from Cedar Creek Farm', 'Pasture-raised in Sonoma', 'Day-boat caught off the coast', 'Free-range from our partner ranch']).sample(random: rng)}. Cooked over #{(['white oak', 'almond wood', 'cherry wood']).sample(random: rng)} embers."
    end

    paragraphs << "Pairs beautifully with our #{(['house cocktail', 'natural wine selection', 'cold-pressed juice', 'tea program']).sample(random: rng)}."
    paragraphs.join("\n\n")
  end

  def menu_item_tags(category)
    pool = ['gluten-free', 'vegetarian', 'vegan', 'spicy', 'contains nuts', 'shellfish', 'chef\'s pick', 'seasonal', 'house favorite', 'limited']
    pool.sample(rng.rand(0..3), random: rng).tap do |tags|
      tags << 'dessert' if category == 'Dessert'
    end
  end

  def reviews_payload
    (1..40).map do |i|
      reviewer = (['Jamie K.', 'Sarah M.', 'Diego R.', 'Priya S.', 'Casey L.', 'Alex T.', 'Morgan B.', 'Riley J.', 'Quinn P.', 'Sage W.']).sample(random: rng)
      rating = rng.rand(3..5)
      built_at = (Time.zone.now - rng.rand(1..720).hours).iso8601
      {
        id: i,
        reviewer: "#{reviewer}#{i}",
        rating: rating,
        title: review_title(rating),
        body: review_body(rating, i),
        helpful_count: rng.rand(0..120),
        verified: rng.rand(10).positive?,
        created_at: built_at,
      }
    end
  end

  def review_title(rating)
    case rating
    when 5 then (['Outstanding from start to finish', 'A new favorite', 'Worth the wait', 'Better every time', 'A genuine experience', 'Best meal of the year']).sample(random: rng)
    when 4 then (['Very strong, with one quibble', 'Highly recommended', 'Great food, mixed service', 'Would return', 'Solid all around']).sample(random: rng)
    else (['Good but uneven', 'Mixed feelings', 'Some hits, some misses', 'Underwhelmed by mains', 'Service let it down']).sample(random: rng)
    end
  end

  def review_body(rating, idx)
    paragraphs = []
    paragraphs << <<~MD.strip
      We came here for #{(['a special occasion', 'a Friday night dinner', 'an anniversary', 'a casual lunch', 'a work meeting', 'a family birthday']).sample(random: rng)} and overall the experience was #{rating >= 4 ? 'memorable in the best way' : 'mixed but interesting'}.
    MD

    paragraphs << "The standouts were the **#{(['octopus starter', 'short rib', 'whole branzino', 'house pasta', 'tasting menu', 'wine pairing']).sample(random: rng)}** and the **#{(['olive oil cake', 'burnt cheesecake', 'sorbet', 'final amuse']).sample(random: rng)}**. Both were #{(['transcendent', 'beautifully balanced', 'better than I expected', 'memorable for the right reasons']).sample(random: rng)}."

    if rating >= 4
      paragraphs << <<~MD.strip
        A tip for first-timers: #{(["sit at the bar if you're solo or a pair", "ask for the chef's selection", "save room for two desserts, not one", "request the wine pairing — it's worth every dollar"]).sample(random: rng)}.

        ```javascript
        // For our developer friends — their reservation API is excellent
        await reserve('#{idx}', { partySize: #{rng.rand(2..6)}, time: '#{(['7:00pm', '8:30pm', '6:00pm']).sample(random: rng)}' });
        ```
      MD
    else
      paragraphs << "What kept this from a higher score: #{(['service felt rushed at the end of the night', 'two of the four mains were under-seasoned', 'the wine pairing was mismatched', 'the room was loud enough to drown out conversation']).sample(random: rng)}. Hopefully these are off nights — the kitchen clearly has the capability."
    end

    paragraphs << "Would I come back? **#{rating >= 4 ? 'Absolutely — already booked.' : "Probably, but I'd order differently."}**"
    paragraphs.join("\n\n")
  end

  def hours_payload
    days = %w[Monday Tuesday Wednesday Thursday Friday Saturday Sunday]
    days.map do |day|
      open_h  = rng.rand(11..12)
      close_h = rng.rand(21..23)
      closed = (day == 'Monday' && rng.rand(3).zero?)
      { day: day, open: closed ? nil : "#{open_h}:00", close: closed ? nil : "#{close_h}:00", closed: closed }
    end
  end

  def faq_markdown
    questions = [
      ['Do you take walk-ins?', "Yes — about 30% of our seats are reserved for walk-ins each night. Bar seating is always first-come, first-served. We do not maintain a wait list by phone; please come in and we'll do our best."],
      ['Are reservations required for the tasting menu?', "Yes, the **5-course tasting** requires a reservation at least 48 hours in advance, and a credit card hold is taken. We can accommodate dietary restrictions provided we have notice."],
      ['Do you accommodate dietary restrictions?', "We can prepare gluten-free, vegetarian, vegan, and most allergy-conscious meals with notice. Please flag any restrictions when you book — last-minute restrictions are difficult on a busy night."],
      ['Is there parking?', "Street parking is plentiful after 6pm. There's a paid lot one block south. We do not validate parking, but bicycle racks are available out front."],
      ['Do you cater?', "We cater select events in our private room (up to 24 seated, 40 standing). Please email events@example.com with your date and party size for a quote."],
      ['Can I bring my own wine?', "We offer a $#{rng.rand(20..40)} corkage for bottles not on our list. Please limit to one bottle per four guests."],
      ['Are children welcome?', "Yes, particularly during early service (5:30–7:00pm). We have a small kids' menu and high chairs available. After 8pm the room volume is more adult."],
      ['What is the dress code?', "Smart casual. We have no formal dress requirement, but most guests dress for a special occasion."],
    ]
    md = ["## Frequently Asked Questions\n"]
    questions.each do |q, a|
      md << "**#{q}**\n\n#{a}\n"
    end
    md.join("\n")
  end

  def neighborhood_markdown
    <<~MD
      ## #{restaurant.city || 'The Neighborhood'}

      We sit on a quiet block in #{restaurant.city || 'town'}, three minutes from the #{(['public market', 'central library', 'transit station', 'riverfront walk']).sample(random: rng)} and ten minutes from the cluster of #{(['art galleries', 'theaters', 'live music venues', 'independent bookstores']).sample(random: rng)} that anchor the district.

      ### Recommended pairings

      Make a night of it:

      1. **Before dinner** — #{(['cocktails next door at The Long Room', 'an early walk along the river', 'the 6:30pm gallery hour at the Modern', 'a cup of espresso at Chapter 7']).sample(random: rng)}
      2. **After dinner** — #{(['live jazz at the Blue Door (two blocks north)', 'a slice at the late-night bakery on Elm', 'the rooftop bar at the Norwood Hotel', 'a long walk through Cedar Park']).sample(random: rng)}
      3. **Sunday morning** — #{(['the farmers market on West Street (open 8am–1pm)', 'brunch at our sister restaurant Rosita', 'the trail behind Riverside Common']).sample(random: rng)}

      ### Getting here

      | Mode | Distance | Notes |
      |------|----------|-------|
      | Subway | 4 minutes | #{(['Red', 'Blue', 'Green']).sample(random: rng)} line, #{(['Central Square', 'Park Street', 'Union Plaza']).sample(random: rng)} |
      | Bus | 6 minutes | Routes #{(['12, 14', '8, 22', '17']).sample(random: rng)} stop one block away |
      | Bike | 12 minutes | Dedicated bike racks; bike-share station at the corner |
      | Car | varies | Street parking after 6pm; paid lot one block south |
    MD
  end

  def stats_payload
    {
      avg_party_size: rng.rand(2.0..4.5).round(1),
      tables: rng.rand(18..36),
      menu_items_count: 80,
      reviews_count: 40,
      years_open: rng.rand(8..18),
      staff_count: rng.rand(14..32),
      seasonal_menu_changes_per_year: rng.rand(4..12),
    }
  end
end
