// KALORA Lebensmitteldatenbank
// Nährwerte pro 100 g (bzw. 100 ml) – Richtwerte angelehnt an den Bundeslebensmittelschlüssel (BLS)
// und Herstellerangaben gängiger Produkte im deutschen Handel.
//
// Spalten: key, name, kcal, protein, kohlenhydrate, fett, zucker, ballaststoffe,
//          einkaufskategorie, preis (€/kg bzw. €/l), typ, stückgewicht (g), TheMealDB-Zutatenbild
// typ: V = vegan, v = vegetarisch, m = Fleisch, f = Fisch, s = Meeresfrüchte
// kategorie: og Obst & Gemüse, ff Fleisch & Fisch, mp Milchprodukte & Eier, gt Getränke,
//            hh Haushalt, fp Fitnessprodukte, vr Vorrat, bk Brot & Backwaren, gw Gewürze & Saucen, tk Tiefkühl

const RAW = [
  // ---------- Fleisch ----------
  ['haehnchenbrust', 'Hähnchenbrust', 110, 23.5, 0, 1.5, 0, 0, 'ff', 11.9, 'm', 170, 'Chicken Breast'],
  ['haehnchenschenkel', 'Hähnchenschenkel (ohne Haut)', 160, 19, 0, 9, 0, 0, 'ff', 7.9, 'm', 120, 'Chicken Thighs'],
  ['haehnchenkeule', 'Hähnchenkeule', 180, 18, 0, 12, 0, 0, 'ff', 5.9, 'm', 250, 'Chicken Legs'],
  ['haehnchen', 'Hähnchen (ganz)', 165, 19, 0, 10, 0, 0, 'ff', 5.5, 'm', 1400, 'Chicken'],
  ['rinderhack', 'Rinderhackfleisch (mager)', 175, 21, 0, 10, 0, 0, 'ff', 11.9, 'm', null, 'Minced Beef'],
  ['rindersteak', 'Rindersteak (Hüfte)', 125, 22, 0, 4, 0, 0, 'ff', 29.9, 'm', 200, 'Sirloin Steak'],
  ['rinderfilet', 'Rinderfilet', 120, 21, 0, 4, 0, 0, 'ff', 49.9, 'm', null, 'Beef Fillet'],
  ['rindergulasch', 'Rindergulasch', 130, 21, 0, 5, 0, 0, 'ff', 15.9, 'm', null, 'Beef'],
  ['tafelspitz', 'Tafelspitz (Rind)', 140, 21, 0, 6, 0, 0, 'ff', 21.9, 'm', null, 'Beef Brisket'],
  ['schweinehack', 'Schweinehackfleisch', 210, 18, 0, 15, 0, 0, 'ff', 8.9, 'm', null, 'Minced Pork'],
  ['schweinenacken', 'Schweinenacken', 190, 18, 0, 13, 0, 0, 'ff', 8.9, 'm', null, 'Pork'],
  ['schweinekotelett', 'Schweinekotelett', 150, 21, 0, 7, 0, 0, 'ff', 9.9, 'm', 180, 'Pork Chops'],
  ['bacon', 'Bacon / Frühstücksspeck', 400, 14, 1, 38, 0.5, 0, 'ff', 18.9, 'm', 12, 'Bacon'],
  ['chorizo', 'Chorizo', 455, 24, 2, 38, 1, 0, 'ff', 19.9, 'm', null, 'Chorizo'],
  ['bratwurst', 'Räucherwurst', 300, 14, 1, 27, 0.5, 0, 'ff', 9.9, 'm', 100, 'Sausages'],
  ['putenbrust', 'Putenbrust', 105, 24, 0, 1, 0, 0, 'ff', 12.9, 'm', 150, 'Turkey Mince'],
  ['kochschinken', 'Kochschinken', 110, 19, 1, 3.5, 1, 0, 'ff', 14.9, 'm', 20, 'Ham'],
  // ---------- Fisch & Meeresfrüchte ----------
  ['lachs', 'Lachsfilet', 200, 20, 0, 13, 0, 0, 'ff', 24.9, 'f', 125, 'Salmon'],
  ['raeucherlachs', 'Räucherlachs', 180, 21, 0, 10, 0, 0, 'ff', 39.9, 'f', 20, 'Smoked Salmon'],
  ['thunfisch', 'Thunfisch (Dose, im eigenen Saft)', 110, 25, 0, 1, 0, 0, 'ff', 13.9, 'f', 150, 'Tuna'],
  ['thunfischsteak', 'Thunfischsteak', 130, 24, 0, 3.5, 0, 0, 'ff', 34.9, 'f', 150, 'Tuna'],
  ['weisserfisch', 'Seelachs-/Kabeljaufilet', 80, 18, 0, 0.8, 0, 0, 'ff', 16.9, 'f', 125, 'White Fish'],
  ['garnelen', 'Garnelen (roh, geschält)', 85, 19, 0.5, 1, 0, 0, 'ff', 24.9, 's', null, 'Raw King Prawns'],
  // ---------- Milchprodukte & Eier ----------
  ['ei', 'Ei (Größe M)', 155, 13, 1, 11, 1, 0, 'mp', 5.0, 'v', 60, 'Egg'],
  ['eigelb', 'Eigelb', 340, 16, 0.5, 31, 0.5, 0, 'mp', 9.0, 'v', 18, 'Egg Yolks'],
  ['milch', 'Milch 1,5 %', 47, 3.4, 4.9, 1.5, 4.9, 0, 'mp', 1.15, 'v', null, 'Milk'],
  ['vollmilch', 'Vollmilch 3,5 %', 64, 3.3, 4.8, 3.5, 4.8, 0, 'mp', 1.25, 'v', null, 'Milk'],
  ['skyr', 'Skyr Natur', 63, 11, 4, 0.2, 4, 0, 'mp', 3.3, 'v', null, 'Greek Yogurt'],
  ['skyrvanille', 'Skyr Vanille', 75, 9.5, 8.5, 0.2, 8.5, 0, 'mp', 3.8, 'v', null, 'Greek Yogurt'],
  ['magerquark', 'Magerquark', 67, 12, 4, 0.3, 4, 0, 'mp', 3.0, 'v', null, null],
  ['griechjoghurt', 'Griechischer Joghurt 10 %', 125, 4.5, 4, 10, 4, 0, 'mp', 4.5, 'v', null, 'Greek Yogurt'],
  ['proteinjoghurt', 'High-Protein-Joghurt', 60, 10, 4, 0.2, 3.5, 0, 'fp', 4.9, 'v', null, 'Greek Yogurt'],
  ['naturjoghurt', 'Naturjoghurt 3,5 %', 64, 3.8, 4.5, 3.5, 4.5, 0, 'mp', 2.0, 'v', null, 'Yogurt'],
  ['feta', 'Feta', 265, 16, 1, 21, 1, 0, 'mp', 11.9, 'v', null, 'Feta'],
  ['mozzarella', 'Mozzarella', 250, 18, 1, 19, 1, 0, 'mp', 7.9, 'v', 125, 'Mozzarella'],
  ['parmesan', 'Parmesan', 400, 33, 0, 29, 0, 0, 'mp', 24.9, 'v', null, 'Parmesan'],
  ['pecorino', 'Pecorino', 390, 28, 0, 31, 0, 0, 'mp', 24.9, 'v', null, 'Pecorino'],
  ['cheddar', 'Cheddar', 400, 25, 1, 33, 0.5, 0, 'mp', 13.9, 'v', null, 'Cheddar Cheese'],
  ['bergkaese', 'Bergkäse', 400, 28, 0, 32, 0, 0, 'mp', 19.9, 'v', null, 'Cheese'],
  ['reibekaese', 'Geriebener Käse (Mexikanisch)', 350, 25, 1.5, 28, 0.5, 0, 'mp', 9.9, 'v', null, 'Cheese'],
  ['huettenkaese', 'Hüttenkäse', 95, 12.5, 2.5, 4, 2.5, 0, 'mp', 4.4, 'v', null, null],
  ['ricotta', 'Ricotta', 145, 9, 3, 11, 3, 0, 'mp', 8.9, 'v', null, 'Ricotta'],
  ['mascarpone', 'Mascarpone', 410, 4.5, 3.5, 42, 3.5, 0, 'mp', 9.9, 'v', null, 'Mascarpone'],
  ['frischkaese', 'Frischkäse', 240, 6, 3.5, 23, 3.5, 0, 'mp', 7.9, 'v', null, 'Cream Cheese'],
  ['cremefraiche', 'Crème fraîche', 290, 2.5, 3, 30, 3, 0, 'mp', 7.5, 'v', null, 'Creme Fraiche'],
  ['schmand', 'Schmand / Saure Sahne', 200, 3, 4, 20, 4, 0, 'mp', 4.9, 'v', null, 'Sour Cream'],
  ['sahne', 'Schlagsahne 30 %', 290, 2.4, 3.2, 30, 3.2, 0, 'mp', 6.0, 'v', null, 'Double Cream'],
  ['butter', 'Butter', 740, 0.7, 0.6, 82, 0.6, 0, 'mp', 9.5, 'v', null, 'Butter'],
  ['paneer', 'Paneer', 300, 19, 3, 24, 2, 0, 'mp', 14.9, 'v', null, 'Paneer'],
  ['sojamilch', 'Sojadrink', 39, 3.3, 2.5, 1.8, 2.5, 0.5, 'mp', 1.9, 'V', null, 'Soya Milk'],
  ['veganebutter', 'Pflanzliche Margarine', 720, 0, 0.5, 80, 0, 0, 'mp', 6.0, 'V', null, 'Butter'],
  ['tofu', 'Tofu natur', 125, 13, 1.5, 7.5, 0.5, 1, 'mp', 9.9, 'V', 200, 'Tofu'],
  ['tempeh', 'Tempeh', 195, 19, 9, 11, 0.5, 5, 'mp', 14.9, 'V', 200, 'Tempeh'],
  // ---------- Getreide, Nudeln, Reis ----------
  ['reis', 'Basmatireis (roh)', 350, 7.5, 77, 0.6, 0.2, 1.3, 'vr', 3.5, 'V', null, 'Basmati Rice'],
  ['vollkornreis', 'Naturreis (roh)', 350, 7.5, 73, 2.5, 0.7, 3.5, 'vr', 3.3, 'V', null, 'Brown Rice'],
  ['jasminreis', 'Jasminreis (roh)', 355, 7, 79, 0.6, 0.2, 1.2, 'vr', 3.8, 'V', null, 'Jasmine Rice'],
  ['sushireis', 'Sushireis (roh)', 350, 6.5, 78, 0.5, 0, 1, 'vr', 5.9, 'V', null, 'Sushi Rice'],
  ['spaghetti', 'Spaghetti (roh)', 355, 12.5, 71, 1.5, 3, 3, 'vr', 2.0, 'V', null, 'Spaghetti'],
  ['penne', 'Penne (roh)', 355, 12.5, 71, 1.5, 3, 3, 'vr', 2.0, 'V', null, 'Penne Rigate'],
  ['farfalle', 'Farfalle (roh)', 355, 12.5, 71, 1.5, 3, 3, 'vr', 2.4, 'V', null, 'Farfalle'],
  ['bandnudeln', 'Bandnudeln / Tagliatelle (roh)', 360, 13, 70, 2.5, 2.5, 3, 'vr', 3.5, 'v', null, 'Tagliatelle'],
  ['paratha', 'Roti / Paratha', 310, 7, 45, 11, 2, 3, 'bk', 9.0, 'V', 70, 'Bread'],
  ['burgerbroetchen', 'Burgerbrötchen', 270, 9, 48, 4.5, 6, 2.5, 'bk', 6.0, 'v', 75, 'Bread'],
  ['pita', 'Pitabrot', 275, 9, 55, 1.2, 2, 2.2, 'bk', 6.0, 'V', 80, 'Bread'],
  ['lasagneplatten', 'Lasagneplatten (roh)', 355, 12, 71, 1.5, 3, 3, 'vr', 3.4, 'V', null, 'Lasagne Sheets'],
  ['cannelloni', 'Cannelloni (roh)', 355, 12, 71, 1.5, 3, 3, 'vr', 4.9, 'V', null, null],
  ['reisnudeln', 'Reisnudeln (roh)', 360, 6, 82, 0.6, 0, 1.5, 'vr', 5.9, 'V', null, 'Rice Vermicelli'],
  ['udon', 'Udon-Nudeln (vorgegart)', 130, 3.5, 27, 0.5, 0.5, 1.2, 'vr', 7.9, 'V', 200, 'Udon Noodles'],
  ['couscous', 'Couscous (roh)', 360, 12, 73, 1.5, 1, 4, 'vr', 3.9, 'V', null, 'Couscous'],
  ['quinoa', 'Quinoa (roh)', 370, 14, 64, 6, 1, 7, 'vr', 9.9, 'V', null, 'Quinoa'],
  ['haferflocken', 'Haferflocken', 370, 13.5, 59, 7, 1, 10, 'vr', 1.8, 'V', null, 'Oats'],
  ['mehl', 'Weizenmehl Type 405', 345, 10, 71, 1, 0.5, 4, 'vr', 0.9, 'V', null, 'Plain Flour'],
  ['speisestaerke', 'Speisestärke', 350, 0.5, 86, 0.1, 0, 0.5, 'vr', 3.0, 'V', null, 'Cornstarch'],
  ['paniermehl', 'Paniermehl', 360, 11, 72, 2.5, 4, 4.5, 'vr', 2.5, 'V', null, 'Breadcrumbs'],
  ['vollkornbrot', 'Vollkornbrot', 220, 7.5, 39, 1.5, 3, 7.5, 'bk', 4.5, 'V', 50, 'Bread'],
  ['broetchen', 'Brötchen vom Vortag', 260, 9, 51, 1.5, 3, 3, 'bk', 4.0, 'V', 55, 'Bread'],
  ['baguette', 'Baguette', 260, 8.5, 52, 1.2, 3, 3, 'bk', 4.0, 'V', 250, 'Baguette'],
  ['toastbrot', 'Englische Muffins / Toast', 235, 8, 45, 2, 4, 3, 'bk', 4.5, 'V', 60, 'English Muffins'],
  ['tortilla', 'Weizentortilla', 300, 8.5, 50, 7, 2.5, 3, 'bk', 7.5, 'V', 40, 'Flour Tortilla'],
  ['maistortilla', 'Maistortilla', 220, 5.7, 45, 2.8, 1, 6, 'bk', 9.0, 'V', 30, 'Corn Tortillas'],
  ['naan', 'Naanbrot', 290, 9, 50, 5.5, 3, 2, 'bk', 8.0, 'v', 90, 'Naan Bread'],
  ['reispapier', 'Reispapier', 340, 6, 78, 0.5, 0, 1.5, 'vr', 14.0, 'V', 9, 'Rice Vermicelli'],
  ['blaetterteig', 'Blätterteig (Kühlregal)', 390, 5.5, 37, 24, 2, 1.5, 'mp', 5.5, 'V', null, 'Puff Pastry'],
  ['baiser', 'Baiser / Meringue', 390, 5, 92, 0.2, 90, 0, 'vr', 18.0, 'v', 8, 'Meringue Nests'],
  ['butterkekse', 'Vollkorn-Butterkekse', 480, 7, 65, 21, 22, 3.5, 'vr', 5.5, 'v', null, 'Digestive Biscuits'],
  // ---------- Kartoffeln, Hülsenfrüchte ----------
  ['kartoffel', 'Kartoffeln', 75, 2, 15, 0.1, 0.8, 2, 'og', 1.4, 'V', 150, 'Potatoes'],
  ['drillinge', 'Drillinge (kleine Kartoffeln)', 75, 2, 15, 0.1, 0.8, 2, 'og', 2.2, 'V', 40, 'New Potatoes'],
  ['suesskartoffel', 'Süßkartoffel', 86, 1.6, 20, 0.1, 4.2, 3, 'og', 3.0, 'V', 300, 'Sweet Potatoes'],
  ['kichererbsen', 'Kichererbsen (Dose, abgetropft)', 120, 7, 16, 2.5, 0.5, 6, 'vr', 3.5, 'V', null, 'Chickpeas'],
  ['kidneybohnen', 'Kidneybohnen (Dose, abgetropft)', 105, 7.5, 14, 0.5, 0.5, 7, 'vr', 3.0, 'V', null, 'Kidney Beans'],
  ['weissebohnen', 'Weiße Bohnen / Cannellini (Dose, abgetropft)', 100, 7, 13, 0.5, 0.5, 6, 'vr', 3.0, 'V', null, 'Cannellini Beans'],
  ['schwarzebohnen', 'Schwarze Bohnen (Dose, abgetropft)', 110, 7.5, 15, 0.5, 0.3, 7.5, 'vr', 3.5, 'V', null, 'Black Beans'],
  ['borlottibohnen', 'Borlottibohnen (Dose, abgetropft)', 105, 7.5, 14, 0.5, 0.3, 7, 'vr', 3.5, 'V', null, 'Borlotti Beans'],
  ['linsenrot', 'Rote Linsen (roh)', 340, 24, 50, 1.5, 2, 11, 'vr', 4.5, 'V', null, 'Red Lentils'],
  ['linsenbraun', 'Braune Linsen (roh)', 330, 23, 48, 1.5, 2, 15, 'vr', 3.9, 'V', null, 'Brown Lentils'],
  ['toordal', 'Toor Dal / gelbe Linsen (roh)', 340, 22, 57, 1.5, 3, 15, 'vr', 5.9, 'V', null, 'Toor Dal'],
  ['edamame', 'Edamame (TK)', 125, 11, 9, 5, 2, 5, 'tk', 7.9, 'V', null, 'Soya Bean'],
  // ---------- Gemüse ----------
  ['brokkoli', 'Brokkoli', 35, 3, 4, 0.4, 1.7, 3, 'og', 3.5, 'V', 500, 'Broccoli'],
  ['pakchoi', 'Pak Choi', 13, 1.5, 1.2, 0.2, 1.2, 1, 'og', 5.9, 'V', 250, 'Pak Choi'],
  ['gailan', 'Chinesischer Brokkoli (Gai Lan)', 22, 1.1, 3.8, 0.7, 0.8, 2.5, 'og', 7.9, 'V', 300, 'Broccoli'],
  ['paprika', 'Paprika rot', 31, 1, 6, 0.3, 4.2, 2, 'og', 4.5, 'V', 160, 'Red Pepper'],
  ['paprikagruen', 'Paprika grün', 20, 0.9, 3, 0.2, 2.4, 1.7, 'og', 4.0, 'V', 160, 'Green Pepper'],
  ['paprikagelb', 'Paprika gelb', 27, 1, 5.3, 0.2, 4, 1, 'og', 4.5, 'V', 160, 'Yellow Pepper'],
  ['zwiebel', 'Zwiebel', 40, 1.1, 9, 0.1, 4.2, 1.7, 'og', 1.5, 'V', 100, 'Onion'],
  ['rotezwiebel', 'Rote Zwiebel', 40, 1.1, 9, 0.1, 4.2, 1.7, 'og', 2.5, 'V', 100, 'Red Onions'],
  ['schalotte', 'Schalotte', 72, 2.5, 17, 0.1, 8, 3, 'og', 5.0, 'V', 30, 'Shallots'],
  ['fruehlingszwiebel', 'Frühlingszwiebel', 32, 1.8, 7, 0.2, 2.3, 2.6, 'og', 6.0, 'V', 15, 'Spring Onions'],
  ['knoblauch', 'Knoblauch', 150, 6.4, 33, 0.5, 1, 2, 'og', 10.0, 'V', 5, 'Garlic'],
  ['ingwer', 'Ingwer', 80, 1.8, 18, 0.8, 1.7, 2, 'og', 6.0, 'V', 20, 'Ginger'],
  ['chili', 'Chilischote', 40, 1.9, 9, 0.4, 5, 1.5, 'og', 20.0, 'V', 10, 'Red Chilli'],
  ['tomate', 'Tomate', 18, 0.9, 3.9, 0.2, 2.6, 1.2, 'og', 3.5, 'V', 120, 'Tomatoes'],
  ['kirschtomate', 'Kirschtomaten', 20, 1, 3.5, 0.2, 3, 1.5, 'og', 6.0, 'V', 15, 'Cherry Tomatoes'],
  ['dosentomaten', 'Gehackte Tomaten (Dose)', 22, 1.2, 3.5, 0.2, 3.5, 1, 'vr', 2.0, 'V', null, 'Chopped Tomatoes'],
  ['tomatenmark', 'Tomatenmark', 80, 4.5, 13, 0.5, 11, 3, 'vr', 6.0, 'V', null, 'Tomato Puree'],
  ['karotte', 'Karotte', 36, 0.9, 7, 0.2, 4.7, 2.8, 'og', 1.5, 'V', 80, 'Carrots'],
  ['zucchini', 'Zucchini', 17, 1.2, 2.2, 0.3, 1.7, 1.1, 'og', 2.5, 'V', 250, 'Courgettes'],
  ['aubergine', 'Aubergine', 24, 1, 3, 0.2, 2.4, 3, 'og', 3.5, 'V', 300, 'Aubergine'],
  ['gurke', 'Salatgurke', 15, 0.6, 2, 0.1, 1.7, 0.7, 'og', 2.2, 'V', 400, 'Cucumber'],
  ['spinat', 'Babyspinat', 23, 2.9, 0.6, 0.4, 0.4, 2.2, 'og', 10.0, 'V', null, 'Spinach'],
  ['gruenkohl', 'Grünkohl', 50, 4.3, 2.5, 0.9, 2, 4.2, 'og', 6.0, 'V', null, 'Kale'],
  ['kohl', 'Weißkohl', 25, 1.4, 4.2, 0.2, 3.5, 3, 'og', 1.2, 'V', 1200, 'Cabbage'],
  ['sauerkraut', 'Sauerkraut', 20, 1.5, 0.8, 0.3, 0.8, 2.5, 'vr', 2.2, 'V', null, 'Sauerkraut'],
  ['erbsen', 'Erbsen (TK)', 80, 6, 11, 0.5, 4, 5, 'tk', 3.0, 'V', null, 'Peas'],
  ['gruenebohnen', 'Grüne Bohnen', 32, 2.4, 5, 0.2, 2.5, 2.7, 'og', 6.0, 'V', null, 'Green Beans'],
  ['mais', 'Mais (Dose, abgetropft)', 85, 3, 15, 1.2, 4.5, 2.7, 'vr', 3.5, 'V', null, 'Sweetcorn'],
  ['champignons', 'Champignons', 22, 3, 0.6, 0.3, 0.2, 2, 'og', 6.0, 'V', null, 'Mushrooms'],
  ['shiitake', 'Shiitake-Pilze', 35, 2.2, 5, 0.5, 2.4, 2.5, 'og', 24.0, 'V', 15, 'Shiitake Mushrooms'],
  ['fenchel', 'Fenchel', 31, 1.2, 3, 0.2, 3, 3.3, 'og', 4.5, 'V', 250, 'Fennel'],
  ['sellerie', 'Staudensellerie', 16, 0.7, 1.4, 0.2, 1.3, 1.6, 'og', 3.5, 'V', 40, 'Celery'],
  ['knollensellerie', 'Knollensellerie', 42, 1.5, 6, 0.3, 2, 4, 'og', 2.5, 'V', 600, 'Celeriac'],
  ['pastinake', 'Pastinake', 75, 1.2, 13, 0.3, 4.8, 4.9, 'og', 4.0, 'V', 150, 'Parsnips'],
  ['lauch', 'Lauch', 31, 1.5, 4.5, 0.3, 3.5, 2.3, 'og', 3.0, 'V', 250, 'Leek'],
  ['kuerbis', 'Butternut-Kürbis', 45, 1, 10, 0.1, 2.2, 2, 'og', 2.5, 'V', 1200, 'Butternut Squash'],
  ['sprossen', 'Mungbohnensprossen', 30, 3, 4, 0.2, 4, 1.8, 'og', 8.0, 'V', null, 'Bean Sprouts'],
  ['wasserkastanien', 'Wasserkastanien (Dose)', 60, 1, 13, 0.1, 3, 2.5, 'vr', 9.0, 'V', null, 'Water Chestnut'],
  ['salat', 'Romanasalat', 17, 1.2, 2, 0.3, 1.2, 2, 'og', 4.5, 'V', 300, 'Lettuce'],
  ['rucola', 'Rucola', 25, 2.6, 2, 0.7, 2, 1.6, 'og', 15.0, 'V', null, 'Rocket'],
  ['radieschen', 'Radieschen', 16, 1, 2, 0.1, 1.9, 1.6, 'og', 6.0, 'V', 10, 'Radish'],
  ['rotebete', 'Rote Bete (gegart)', 45, 1.7, 8, 0.1, 7, 2.5, 'og', 4.0, 'V', 150, 'Beetroot'],
  ['rhabarber', 'Rhabarber', 21, 0.9, 1.4, 0.2, 1.1, 1.8, 'og', 4.0, 'V', null, 'Rhubarb'],
  ['oliven', 'Oliven (schwarz/grün)', 145, 1, 1, 15, 0, 3.3, 'vr', 12.0, 'V', null, 'Black Olives'],
  ['kapern', 'Kapern', 23, 2.4, 1.7, 0.9, 0.4, 3.2, 'vr', 20.0, 'V', null, 'Capers'],
  ['avocado', 'Avocado', 160, 2, 1.8, 15, 0.7, 6.7, 'og', 8.0, 'V', 170, 'Avocado'],
  ['rohkost', 'Rohkost-Mix (Karotte, Gurke, Rettich)', 25, 1, 4.5, 0.2, 3.5, 2, 'og', 4.0, 'V', null, 'Carrots'],
  ['wokgemuese', 'Wokgemüse-Mischung (TK)', 35, 2, 5, 0.3, 3, 2.5, 'tk', 4.0, 'V', null, 'Broccoli'],
  ['ofengemuese', 'Ofengemüse (Paprika, Zucchini, Zwiebel)', 45, 1.3, 6, 1.5, 4.5, 2.2, 'og', 4.0, 'V', null, 'Red Pepper'],
  // ---------- Kräuter ----------
  ['koriander', 'Koriander (frisch)', 23, 2.1, 3.7, 0.5, 0.9, 2.8, 'og', 35.0, 'V', null, 'Coriander'],
  ['petersilie', 'Petersilie (frisch)', 36, 3, 6, 0.8, 0.9, 3.3, 'og', 30.0, 'V', null, 'Parsley'],
  ['basilikum', 'Basilikum (frisch)', 23, 3.2, 2.7, 0.6, 0.3, 1.6, 'og', 40.0, 'V', null, 'Basil'],
  ['minze', 'Minze (frisch)', 44, 3.8, 8, 0.7, 0, 6.8, 'og', 40.0, 'V', null, 'Mint'],
  ['schnittlauch', 'Schnittlauch', 30, 3.3, 4.4, 0.7, 1.9, 2.5, 'og', 40.0, 'V', null, 'Chives'],
  // ---------- Obst ----------
  ['banane', 'Banane', 93, 1.1, 20, 0.2, 17, 2, 'og', 1.8, 'V', 120, 'Banana'],
  ['apfel', 'Apfel', 54, 0.3, 12, 0.2, 10, 2.4, 'og', 2.5, 'V', 150, 'Apples'],
  ['himbeeren', 'Himbeeren', 43, 1.3, 4.8, 0.3, 4.4, 6.7, 'og', 20.0, 'V', null, 'Raspberries'],
  ['heidelbeeren', 'Heidelbeeren', 57, 0.7, 12, 0.3, 10, 2.4, 'og', 16.0, 'V', null, 'Blueberries'],
  ['brombeeren', 'Brombeeren', 43, 1.4, 6, 0.5, 5, 5.3, 'og', 18.0, 'V', null, 'Blackberries'],
  ['erdbeeren', 'Erdbeeren', 32, 0.7, 5.5, 0.4, 5, 2, 'og', 7.0, 'V', null, 'Strawberries'],
  ['mango', 'Mango', 60, 0.8, 13, 0.4, 13, 1.6, 'og', 6.0, 'V', 350, 'Mango'],
  ['zitrone', 'Zitrone (Saft)', 25, 0.4, 6.9, 0.2, 2.5, 0.3, 'og', 3.5, 'V', 100, 'Lemon'],
  ['limette', 'Limette (Saft)', 25, 0.4, 7, 0.1, 1.7, 0.4, 'og', 6.0, 'V', 60, 'Lime'],
  ['spargel', 'Grüner Spargel', 20, 2.2, 2, 0.1, 1.9, 2.1, 'og', 9.0, 'V', 20, 'Asparagus'],
  ['ananas', 'Ananas', 50, 0.5, 12, 0.1, 10, 1.4, 'og', 3.5, 'V', 900, 'Pineapple'],
  ['apfelmus', 'Apfelmus', 75, 0.3, 17, 0.1, 15, 1.5, 'vr', 2.5, 'V', null, 'Apples'],
  ['aprikosengetr', 'Getrocknete Aprikosen', 240, 3.4, 53, 0.5, 53, 7, 'vr', 12.0, 'V', 8, 'Dried Apricots'],
  ['beerenmix', 'Beerenmix (TK)', 40, 1, 7, 0.3, 6, 4, 'tk', 6.0, 'V', null, 'Blueberries'],
  // ---------- Nüsse & Saaten ----------
  ['erdnuesse', 'Erdnüsse (geröstet)', 590, 25, 12, 49, 4, 8, 'vr', 8.0, 'V', null, 'Peanuts'],
  ['erdnussbutter', 'Erdnussmus', 600, 25, 14, 50, 5, 7, 'vr', 11.0, 'V', null, 'Peanut Butter'],
  ['cashews', 'Cashewkerne', 580, 18, 30, 44, 6, 3.3, 'vr', 18.0, 'V', null, 'Cashew Nuts'],
  ['mandeln', 'Mandeln', 600, 21, 6, 52, 4.4, 12.5, 'vr', 14.0, 'V', null, 'Almonds'],
  ['pekannuesse', 'Pekannüsse', 690, 9, 4, 72, 4, 9.6, 'vr', 28.0, 'V', null, 'Pecan Nuts'],
  ['sesam', 'Sesam', 570, 18, 10, 50, 0.5, 12, 'vr', 10.0, 'V', null, 'Sesame Seed'],
  ['tahini', 'Tahini (Sesammus)', 640, 21, 7, 58, 0.5, 9, 'vr', 16.0, 'V', null, 'Tahini'],
  ['hummus', 'Hummus', 240, 7, 11, 18, 0.5, 6, 'mp', 12.0, 'V', null, 'Hummus'],
  // ---------- Öle, Saucen, Gewürze ----------
  ['olivenoel', 'Olivenöl', 884, 0, 0, 100, 0, 0, 'vr', 10.0, 'V', null, 'Olive Oil'],
  ['rapsoel', 'Rapsöl', 884, 0, 0, 100, 0, 0, 'vr', 2.5, 'V', null, 'Vegetable Oil'],
  ['sesamoel', 'Sesamöl', 884, 0, 0, 100, 0, 0, 'vr', 16.0, 'V', null, 'Sesame Seed Oil'],
  ['erdnussoel', 'Erdnussöl', 884, 0, 0, 100, 0, 0, 'vr', 9.0, 'V', null, 'Peanut Oil'],
  ['ghee', 'Ghee', 900, 0, 0, 99.8, 0, 0, 'vr', 18.0, 'v', null, 'Ghee'],
  ['schmalz', 'Schweineschmalz', 900, 0, 0, 99.7, 0, 0, 'vr', 6.0, 'm', null, 'Lard'],
  ['sojasauce', 'Sojasauce', 55, 8, 5, 0.1, 1, 0.8, 'gw', 8.0, 'V', null, 'Soy Sauce'],
  ['austernsauce', 'Austernsauce', 110, 2.5, 23, 0.3, 18, 0.3, 'gw', 10.0, 's', null, 'Oyster Sauce'],
  ['fischsauce', 'Fischsauce', 35, 5, 3.6, 0, 3.6, 0, 'gw', 9.0, 'f', null, 'Fish Sauce'],
  ['hoisin', 'Hoisinsauce', 220, 3.3, 44, 3.4, 27, 2.8, 'gw', 12.0, 'V', null, 'Hoisin Sauce'],
  ['mirin', 'Mirin', 240, 0.3, 43, 0, 43, 0, 'gw', 14.0, 'V', null, 'Mirin'],
  ['sake', 'Sake / Reiswein', 135, 0.5, 5, 0, 0, 0, 'gt', 15.0, 'V', null, 'Sake'],
  ['reisessig', 'Reisessig', 18, 0.3, 0.8, 0, 0.5, 0, 'gw', 6.0, 'V', null, 'Rice Vinegar'],
  ['balsamico', 'Aceto Balsamico', 110, 0.5, 20, 0, 15, 0, 'gw', 8.0, 'V', null, 'Balsamic Vinegar'],
  ['rotweinessig', 'Rotweinessig', 20, 0, 0.3, 0, 0, 0, 'gw', 4.0, 'V', null, 'Red Wine Vinegar'],
  ['weissweinessig', 'Weißweinessig', 20, 0, 0.3, 0, 0, 0, 'gw', 4.0, 'V', null, 'White Wine Vinegar'],
  ['weisswein', 'Weißwein (trocken)', 82, 0.1, 2.6, 0, 0.6, 0, 'gt', 7.0, 'V', null, 'White Wine'],
  ['rotwein', 'Rotwein (trocken)', 85, 0.1, 2.6, 0, 0.6, 0, 'gt', 8.0, 'V', null, 'Red Wine'],
  ['senf', 'Senf (mittelscharf)', 90, 6, 5, 5, 3, 3, 'gw', 5.0, 'V', null, 'Mustard'],
  ['worcester', 'Worcestershiresauce', 80, 0, 19, 0, 10, 0, 'gw', 14.0, 'f', null, 'Worcestershire Sauce'],
  ['ketchup', 'Tomatenketchup', 105, 1.2, 24, 0.2, 22, 0.5, 'gw', 3.5, 'V', null, 'Tomato Ketchup'],
  ['mayonnaise', 'Mayonnaise', 680, 1, 1.5, 75, 1.3, 0, 'gw', 6.0, 'v', null, 'Mayonnaise'],
  ['salsa', 'Tomatensalsa', 35, 1.5, 7, 0.2, 4, 1.5, 'gw', 7.0, 'V', null, 'Salsa'],
  ['harissa', 'Harissa-Paste', 110, 3, 13, 5, 7, 5, 'gw', 14.0, 'V', null, 'Harissa Spice'],
  ['currypaste', 'Grüne Currypaste', 120, 2.5, 13, 6, 5, 4, 'gw', 15.0, 's', null, 'Thai Green Curry Paste'],
  ['kokosmilch', 'Kokosmilch', 180, 1.6, 2.8, 18, 2, 0, 'vr', 4.5, 'V', null, 'Coconut Milk'],
  ['bruehe', 'Gemüse-/Hühnerbrühe (zubereitet)', 5, 0.3, 0.5, 0.2, 0.3, 0, 'gw', 1.5, 'V', null, 'Chicken Stock'],
  ['rinderbruehe', 'Rinderbrühe (zubereitet)', 6, 0.5, 0.4, 0.2, 0.2, 0, 'gw', 1.5, 'm', null, 'Beef Stock'],
  ['honig', 'Honig', 305, 0.4, 76, 0, 75, 0, 'vr', 12.0, 'v', null, 'Honey'],
  ['ahornsirup', 'Ahornsirup', 260, 0, 67, 0, 60, 0, 'vr', 25.0, 'V', null, 'Maple Syrup'],
  ['zucker', 'Zucker', 400, 0, 100, 0, 100, 0, 'vr', 1.2, 'V', null, 'Sugar'],
  ['braunerzucker', 'Brauner Zucker', 390, 0, 98, 0, 97, 0, 'vr', 2.5, 'V', null, 'Brown Sugar'],
  ['kondensmilch', 'Gezuckerte Kondensmilch', 320, 7.5, 55, 8, 55, 0, 'vr', 7.0, 'v', null, 'Condensed Milk'],
  ['kakao', 'Kakaopulver (stark entölt)', 360, 20, 11, 11, 1, 33, 'vr', 14.0, 'V', null, 'Cacao'],
  ['vanille', 'Vanilleextrakt', 290, 0, 13, 0, 13, 0, 'gw', 60.0, 'V', null, 'Vanilla Extract'],
  ['backpulver', 'Backpulver', 100, 0, 25, 0, 0, 0, 'vr', 10.0, 'V', null, 'Baking Powder'],
  ['hefe', 'Hefe (frisch)', 105, 12, 9, 1.5, 0, 6, 'mp', 6.0, 'V', null, 'Yeast'],
  ['gelatine', 'Blattgelatine', 340, 85, 0, 0, 0, 0, 'vr', 60.0, 'm', 2, 'Gelatine Leafs'],
  ['gewuerze', 'Gewürze (Mix)', 300, 12, 40, 10, 3, 25, 'gw', 30.0, 'V', null, 'Paprika'],
  ['salz', 'Salz', 0, 0, 0, 0, 0, 0, 'gw', 0.6, 'V', null, 'Salt'],
  ['grandmarnier', 'Orangenlikör', 250, 0, 22, 0, 22, 0, 'gt', 30.0, 'V', null, 'Grand Marnier'],
  ['eiswuerfel', 'Eiswürfel', 0, 0, 0, 0, 0, 0, 'tk', 1.0, 'V', null, null],
  ['sweetchili', 'Sweet-Chili-Sauce', 200, 0.5, 48, 0.5, 45, 1, 'gw', 8.0, 'V', null, 'Sweet Chilli Sauce'],
  ['hotsauce', 'Scharfe Chilisauce', 30, 1, 5, 0.5, 3, 1, 'gw', 12.0, 'V', null, 'Hotsauce'],
  // ---------- Fitness & Snacks ----------
  ['proteinpulver', 'Whey-Proteinpulver', 380, 78, 6, 6, 4, 1, 'fp', 32.0, 'v', null, null],
  ['veganprotein', 'Veganes Proteinpulver', 380, 75, 8, 7, 2, 3, 'fp', 35.0, 'V', null, null],
  ['proteinriegel', 'Proteinriegel', 360, 33, 35, 12, 3, 12, 'fp', 40.0, 'v', 60, null],
  ['reiswaffel', 'Reiswaffeln', 385, 8, 80, 3, 0.5, 4, 'vr', 9.0, 'V', 8, null],
  ['dunkleschokolade', 'Zartbitterschokolade 85 %', 600, 11, 20, 50, 14, 13, 'vr', 16.0, 'V', null, 'Dark Chocolate'],
  ['milchschokolade', 'Vollmilchschokolade', 540, 7, 57, 31, 55, 2, 'vr', 10.0, 'v', null, 'Milk Chocolate'],
  ['colazero', 'Cola Zero', 0.3, 0, 0, 0, 0, 0, 'gt', 1.1, 'V', null, null],
  ['orangensaft', 'Orangensaft', 45, 0.7, 9, 0.2, 9, 0.2, 'gt', 1.9, 'V', null, null],
  ['wasser', 'Mineralwasser', 0, 0, 0, 0, 0, 0, 'gt', 0.4, 'V', null, null],
]

import { LOCAL_IMAGES } from '../static.js'

export const CATEGORIES = {
  og: { name: 'Obst & Gemüse', emoji: '🥦' },
  ff: { name: 'Fleisch & Fisch', emoji: '🥩' },
  mp: { name: 'Milchprodukte & Kühlregal', emoji: '🥛' },
  gt: { name: 'Getränke', emoji: '🥤' },
  hh: { name: 'Haushalt', emoji: '🧻' },
  fp: { name: 'Fitnessprodukte', emoji: '💪' },
  vr: { name: 'Vorrat & Trockenwaren', emoji: '🥫' },
  bk: { name: 'Brot & Backwaren', emoji: '🥖' },
  gw: { name: 'Gewürze & Saucen', emoji: '🧂' },
  tk: { name: 'Tiefkühl', emoji: '❄️' },
  so: { name: 'Sonstiges', emoji: '🛒' },
}

export const FOODS = {}
for (const [key, name, kcal, p, c, f, s, fi, cat, price, type, piece, tm] of RAW) {
  FOODS[key] = {
    key, name, kcal, p, c, f, s, fi, cat, price, type,
    piece: piece || null,
    image: tm ? (LOCAL_IMAGES ? `img/i/${key}.webp` : `https://www.themealdb.com/images/ingredients/${encodeURIComponent(tm)}-small.png`) : null,
    vegan: type === 'V',
    vegetarian: type === 'V' || type === 'v',
  }
}

export const FOOD_LIST = Object.values(FOODS)

// Abneigungsgruppen: ein Eintrag in "Lebensmittel, die ich nicht mag" trifft alle passenden Zutaten
export const DISLIKE_GROUPS = {
  Pilze: ['champignons', 'shiitake'],
  Fisch: ['lachs', 'raeucherlachs', 'thunfisch', 'weisserfisch', 'fischsauce'],
  Meeresfrüchte: ['garnelen', 'austernsauce'],
  Brokkoli: ['brokkoli', 'gailan'],
  Paprika: ['paprika', 'paprikagruen', 'paprikagelb'],
  Spinat: ['spinat'],
  Oliven: ['oliven'],
  Zwiebeln: ['zwiebel', 'rotezwiebel', 'schalotte'],
  Koriander: ['koriander'],
  Tomaten: ['tomate', 'kirschtomate', 'dosentomaten'],
  Aubergine: ['aubergine'],
  Schweinefleisch: ['schweinehack', 'schweinenacken', 'schweinekotelett', 'bacon', 'chorizo', 'bratwurst', 'schmalz', 'kochschinken'],
  Rindfleisch: ['rinderhack', 'rindersteak', 'rinderfilet', 'rindergulasch', 'tafelspitz'],
  Nüsse: ['erdnuesse', 'erdnussbutter', 'cashews', 'mandeln', 'pekannuesse'],
  Käse: ['feta', 'mozzarella', 'parmesan', 'pecorino', 'cheddar', 'bergkaese', 'reibekaese', 'huettenkaese', 'ricotta', 'paneer'],
  Kokos: ['kokosmilch'],
  Avocado: ['avocado'],
  Fenchel: ['fenchel'],
  Sauerkraut: ['sauerkraut'],
  Tofu: ['tofu', 'tempeh'],
}

export function foodMatchesDislike(foodKey, dislike) {
  const d = dislike.trim().toLowerCase()
  if (!d) return false
  for (const [group, keys] of Object.entries(DISLIKE_GROUPS)) {
    if (group.toLowerCase() === d && keys.includes(foodKey)) return true
  }
  const food = FOODS[foodKey]
  return !!food && food.name.toLowerCase().includes(d)
}

export function nutrientsFor(foodKey, grams) {
  const f = FOODS[foodKey]
  if (!f) return { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 }
  const k = grams / 100
  return { kcal: f.kcal * k, p: f.p * k, c: f.c * k, f: f.f * k, s: f.s * k, fi: f.fi * k }
}

export function searchFoods(q, limit = 20) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return FOOD_LIST
    .map(f => {
      const n = f.name.toLowerCase()
      const score = n.startsWith(s) ? 0 : n.split(/[\s(/-]+/).some(w => w.startsWith(s)) ? 1 : n.includes(s) ? 2 : 9
      return [score, f]
    })
    .filter(([sc]) => sc < 9)
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, f]) => f)
}
