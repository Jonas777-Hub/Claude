// KALORA Rezeptdatenbank
// Jedes Rezept ist mit genau einem Gericht aus TheMealDB verknüpft (mealId). Das Rezeptbild ist das
// Originalfoto genau dieses Gerichts – keine Platzhalter, keine Stockfotos, keine KI-Bilder.
// Die Zutatenlisten wurden an das abgebildete Gericht angepasst (sichtbare Hauptzutaten).
// Mengen gelten für 1 Portion (1 Person). Nährwerte werden aus der Lebensmitteldatenbank berechnet.
import { FOODS, nutrientsFor, foodMatchesDislike } from './foods.js'
import { MEAL_IMAGES } from './mealImages.js'
import { STATIC } from '../static.js'

// Mahlzeiten: F Frühstück, M Mittagessen, A Abendessen, S Snack, D Dessert
const R = (id, mealId, name, desc, meals, cuisine, time, difficulty, ingredients, steps, tags = []) =>
  ({ id, mealId, name, desc, meals, cuisine, time, difficulty, ingredients, steps, tags })

const RAW = [
  // ===================== FRÜHSTÜCK =====================
  R('pancakes-beeren', '52854', 'Pancakes mit Himbeeren & Heidelbeeren', 'Fluffige Pancakes, gestapelt und mit frischen Beeren serviert – der Wochenend-Klassiker.', ['F', 'D'], 'international', 20, 'Einfach',
    [['mehl', 50], ['ei', 60], ['milch', 150], ['rapsoel', 4], ['zucker', 5], ['himbeeren', 40], ['heidelbeeren', 40]],
    ['Mehl, Ei und Milch zu einem glatten Teig verrühren und 5 Minuten quellen lassen.', 'Eine beschichtete Pfanne mit wenig Öl erhitzen.', 'Pro Pancake eine kleine Kelle Teig hineingeben und von jeder Seite ca. 1–2 Minuten goldbraun backen.', 'Pancakes stapeln, mit Beeren belegen und mit etwas Zucker bestreuen.']),
  R('hafer-pancakes', '53331', 'Haferflocken-Pancakes mit Erdbeeren', 'Sättigende Pancakes aus gemahlenen Haferflocken mit Erdbeeren und einem Hauch Ahornsirup.', ['F'], 'international', 20, 'Einfach',
    [['haferflocken', 60], ['ei', 60], ['milch', 80], ['backpulver', 3], ['vanille', 2], ['butter', 5], ['ahornsirup', 10], ['erdbeeren', 60]],
    ['Haferflocken im Mixer fein mahlen.', 'Mit Ei, Milch, Backpulver, Vanille und einer Prise Salz verrühren.', 'Butter in der Pfanne schmelzen und kleine Pancakes bei mittlerer Hitze ausbacken.', 'Mit Erdbeeren und Ahornsirup servieren.'], ['fitness']),
  R('shakshuka', '52963', 'Shakshuka mit Feta', 'Pochierte Eier in einer würzigen Kirschtomatensauce mit Zwiebeln, Chili und Feta.', ['F', 'M'], 'orientalisch', 25, 'Einfach',
    [['olivenoel', 7], ['rotezwiebel', 100], ['chili', 5], ['knoblauch', 5], ['kirschtomate', 300], ['zucker', 3], ['ei', 120], ['feta', 25], ['koriander', 5]],
    ['Olivenöl in einer Pfanne erhitzen, Zwiebel, Chili und Knoblauch 5 Minuten weich dünsten.', 'Kirschtomaten und Zucker zugeben und 10 Minuten zu einer dicken Sauce einkochen.', 'Zwei Mulden formen, die Eier hineinschlagen und abgedeckt 6–8 Minuten stocken lassen.', 'Mit zerbröseltem Feta und Koriander bestreuen.']),
  R('bananen-pancakes', '52855', 'Bananen-Pancakes mit Pekannüssen', 'Pancakes aus nur Banane und Ei – ohne Mehl, mit Himbeeren und gerösteten Pekannüssen.', ['F'], 'international', 15, 'Einfach',
    [['banane', 120], ['ei', 120], ['backpulver', 1], ['vanille', 1], ['rapsoel', 3], ['pekannuesse', 12], ['himbeeren', 60]],
    ['Banane zerdrücken und mit Eiern, Backpulver und Vanille glatt rühren.', 'Pfanne mit wenig Öl erhitzen und kleine Pancakes ausbacken.', 'Pekannüsse ohne Fett anrösten und grob hacken.', 'Pancakes mit Himbeeren und Nüssen servieren.'], ['fitness']),
  R('bratkartoffeln-bacon', '52965', 'Bratkartoffeln mit Bacon & Ahornsirup', 'Knusprige Frühstückskartoffeln mit Bacon, Knoblauch und einem Hauch Ahornsirup.', ['F', 'M'], 'deutsch', 30, 'Einfach',
    [['kartoffel', 300], ['olivenoel', 7], ['bacon', 24], ['knoblauch', 3], ['ahornsirup', 8], ['petersilie', 3]],
    ['Kartoffeln würfeln und 6 Minuten vorkochen, abtropfen lassen.', 'Bacon in der Pfanne knusprig braten und herausnehmen.', 'Kartoffeln im Öl rundum goldbraun braten, Knoblauch kurz mitbraten.', 'Bacon zurück in die Pfanne geben, mit Ahornsirup glasieren, mit Salz, Pfeffer und Petersilie abschmecken.']),
  R('eggs-benedict-lachs', '52962', 'Eggs Benedict mit Räucherlachs', 'Englische Muffins mit Räucherlachs, Avocado, pochiertem Ei und Hollandaise.', ['F'], 'international', 30, 'Mittel',
    [['toastbrot', 60], ['raeucherlachs', 60], ['avocado', 40], ['ei', 120], ['eigelb', 18], ['butter', 25], ['zitrone', 5], ['weissweinessig', 10]],
    ['Für die Hollandaise Eigelb mit Zitronensaft über dem Wasserbad aufschlagen, flüssige Butter langsam einrühren.', 'Wasser mit Essig zum Sieden bringen, Eier nacheinander 3 Minuten pochieren.', 'Muffins halbieren und toasten, mit Avocado und Räucherlachs belegen.', 'Pochierte Eier daraufsetzen und mit Hollandaise überziehen.']),
  R('chorizo-omelett', '53159', 'Kartoffel-Chorizo-Omelett mit Cheddar', 'Herzhaftes Pfannen-Omelett mit Kartoffel, würziger Chorizo und Käse.', ['F', 'M'], 'mediterran', 20, 'Einfach',
    [['kartoffel', 80], ['olivenoel', 4], ['chorizo', 50], ['ei', 180], ['petersilie', 3], ['cheddar', 25]],
    ['Kartoffel in dünne Scheiben schneiden und im Öl 8 Minuten weich braten.', 'Chorizo würfeln und 2 Minuten mitbraten.', 'Eier mit Petersilie verquirlen, darübergießen und bei mittlerer Hitze stocken lassen.', 'Mit Cheddar bestreuen und kurz unter dem Grill gratinieren.'], ['highprotein']),
  R('tortilla-espanola', '52872', 'Tortilla Española mit Tomatenbrot', 'Spanisches Kartoffel-Omelett, dazu Baguette mit Tomate.', ['F', 'M', 'A'], 'mediterran', 40, 'Mittel',
    [['zwiebel', 50], ['olivenoel', 15], ['butter', 6], ['kartoffel', 100], ['knoblauch', 6], ['ei', 120], ['petersilie', 3], ['baguette', 60], ['tomate', 120]],
    ['Zwiebel und Kartoffeln in dünne Scheiben schneiden und in Öl und Butter 15 Minuten langsam garen.', 'Knoblauch zugeben, alles mit den verquirlten Eiern und Petersilie mischen.', 'In der Pfanne bei kleiner Hitze stocken lassen, mit einem Teller wenden und fertig garen.', 'Baguette rösten, mit Tomate einreiben, mit Olivenöl beträufeln und dazu servieren.'], ['vegetarisch']),
  R('huettenkaese-paprika', '53490', 'Mini-Paprika mit Hüttenkäse & Feta', 'Knackige Paprikahälften gefüllt mit einer Kräuter-Hüttenkäse-Feta-Creme.', ['F', 'S'], 'mediterran', 10, 'Einfach',
    [['paprika', 320], ['feta', 50], ['huettenkaese', 100], ['schnittlauch', 3], ['petersilie', 3], ['zitrone', 8]],
    ['Paprika halbieren und entkernen.', 'Hüttenkäse, zerbröselten Feta, Kräuter und Zitronensaft verrühren, mit Salz abschmecken.', 'Die Creme in die Paprikahälften füllen und sofort servieren.'], ['fitness', 'abnehmen']),
  R('mango-smoothie', '53569', 'Cremiger Mango-Smoothie', 'Reife Mango, Vanille und etwas Kondensmilch – eiskalt gemixt.', ['F', 'S'], 'international', 5, 'Einfach',
    [['mango', 250], ['kondensmilch', 35], ['vanille', 1], ['eiswuerfel', 80]],
    ['Mango schälen und das Fruchtfleisch vom Kern schneiden.', 'Mit Kondensmilch, Vanille und Eiswürfeln im Mixer cremig pürieren.', 'Sofort in ein Glas füllen.']),

  // ===================== HÄHNCHEN =====================
  R('honig-balsamico-haehnchen', '52993', 'Honig-Balsamico-Hähnchen mit Brokkoli & Kartoffeln', 'Saftige Hähnchenbrust in Honig-Balsamico-Glasur mit knusprigem Ofenbrokkoli und Kartoffeln.', ['M', 'A'], 'international', 40, 'Einfach',
    [['haehnchenbrust', 170], ['kartoffel', 250], ['brokkoli', 150], ['knoblauch', 5], ['balsamico', 15], ['honig', 10], ['bruehe', 50], ['butter', 5], ['rapsoel', 5], ['olivenoel', 5]],
    ['Ofen auf 220 °C vorheizen. Kartoffeln vierteln, mit Olivenöl mischen und 30 Minuten rösten.', 'Brokkoli in Röschen teilen und nach 15 Minuten mit aufs Blech geben.', 'Hähnchen in Öl von beiden Seiten 5–6 Minuten braten, herausnehmen.', 'Knoblauch, Balsamico, Honig und Brühe in der Pfanne sirupartig einkochen, Butter einrühren.', 'Hähnchen in der Glasur wenden und mit Gemüse servieren.'], ['highprotein', 'mealprep']),
  R('teriyaki-haehnchen-reis', '52772', 'Teriyaki-Hähnchen mit Naturreis und Gemüse', 'Ofen-Auflauf aus Naturreis, Hähnchen und Pfannengemüse in hausgemachter Teriyaki-Sauce.', ['M', 'A'], 'asiatisch', 45, 'Einfach',
    [['haehnchenbrust', 150], ['vollkornreis', 75], ['wokgemuese', 150], ['sojasauce', 30], ['braunerzucker', 12], ['ingwer', 2], ['knoblauch', 3], ['speisestaerke', 8]],
    ['Reis nach Packungsangabe garen. Ofen auf 180 °C vorheizen.', 'Sojasauce, Zucker, Ingwer, Knoblauch und 60 ml Wasser aufkochen, mit angerührter Stärke binden.', 'Hähnchen in Streifen schneiden und in einer Auflaufform verteilen, mit Sauce übergießen.', '25 Minuten backen, Hähnchen zerzupfen.', 'Mit Reis und gedünstetem Gemüse mischen und 10 Minuten weiterbacken.'], ['highprotein', 'mealprep']),
  R('haehnchen-couscous', '52850', 'Harissa-Hähnchen mit Couscous & Kichererbsen', 'Marokkanisch gewürztes Hähnchen auf Couscous mit Aprikosen und Kichererbsen.', ['M', 'A'], 'orientalisch', 25, 'Einfach',
    [['haehnchenbrust', 100], ['olivenoel', 5], ['zwiebel', 50], ['ingwer', 1], ['harissa', 10], ['aprikosengetr', 25], ['kichererbsen', 110], ['couscous', 70], ['bruehe', 100], ['koriander', 5]],
    ['Zwiebel im Öl 5 Minuten anschwitzen.', 'Hähnchen in Stücke schneiden, mit Ingwer und Harissa zugeben und 5 Minuten braten.', 'Aprikosen und Kichererbsen zugeben und erwärmen.', 'Couscous mit heißer Brühe übergießen, 5 Minuten quellen lassen und auflockern.', 'Alles anrichten und mit Koriander bestreuen.'], ['highprotein']),
  R('quinoa-haehnchen-salat', '53011', 'Griechischer Quinoa-Salat mit Hähnchen', 'Warmer Quinoa mit gebratenem Hähnchen, Oliven, Feta, roter Zwiebel und Minze.', ['M'], 'mediterran', 25, 'Einfach',
    [['quinoa', 55], ['butter', 6], ['chili', 3], ['knoblauch', 3], ['haehnchenbrust', 100], ['olivenoel', 7], ['oliven', 15], ['rotezwiebel', 25], ['feta', 25], ['minze', 3], ['zitrone', 10]],
    ['Quinoa nach Packungsangabe garen, mit Butter, Chili und Knoblauch verfeinern.', 'Hähnchen in Streifen schneiden und im Olivenöl 6–8 Minuten braten.', 'Quinoa mit Hähnchen, Oliven, Zwiebel, Feta und Minze mischen.', 'Mit Zitronensaft beträufeln.'], ['highprotein', 'mealprep']),
  R('tandoori-haehnchen', '52806', 'Tandoori-Hähnchen', 'Hähnchenschenkel in würziger Joghurt-Marinade, scharf gegrillt.', ['M', 'A'], 'indisch', 40, 'Mittel',
    [['haehnchenschenkel', 250], ['zitrone', 15], ['gewuerze', 4], ['rotezwiebel', 50], ['rapsoel', 5], ['griechjoghurt', 60], ['ingwer', 5], ['knoblauch', 4]],
    ['Hähnchen einschneiden und mit Zitronensaft, Paprika und Zwiebel marinieren.', 'Joghurt mit Ingwer, Knoblauch und Gewürzen (Garam Masala, Kreuzkümmel, Chili, Kurkuma) verrühren.', 'Hähnchen darin mindestens 1 Stunde marinieren.', 'Auf einem geölten Blech bei 240 °C 20–25 Minuten grillen, bis es leicht schwarze Stellen hat.'], ['highprotein']),
  R('kung-pao-haehnchen', '52945', 'Kung-Pao-Hähnchen', 'Chinesischer Wok-Klassiker mit Hähnchen, Erdnüssen, Paprika und Chili.', ['M', 'A'], 'asiatisch', 25, 'Mittel',
    [['haehnchenbrust', 170], ['sake', 8], ['sojasauce', 8], ['sesamoel', 7], ['speisestaerke', 6], ['chili', 4], ['reisessig', 2], ['braunerzucker', 4], ['fruehlingszwiebel', 20], ['knoblauch', 8], ['rotezwiebel', 30], ['paprika', 40], ['wasserkastanien', 70], ['erdnuesse', 30]],
    ['Hähnchen würfeln und mit Sake, Sojasauce, Sesamöl und Stärke marinieren.', 'Im heißen Wok 4 Minuten scharf anbraten und herausnehmen.', 'Zwiebel, Paprika, Knoblauch und Chili kurz pfannenrühren.', 'Hähnchen, Wasserkastanien, Reisessig und Zucker zugeben und 2 Minuten schwenken.', 'Mit Erdnüssen und Frühlingszwiebeln servieren.'], ['highprotein']),
  R('thai-green-curry', '52814', 'Grünes Thai-Curry mit Hähnchen & Roti', 'Cremiges grünes Curry mit Hähnchen, Kartoffeln und Bohnen, dazu knuspriges Roti.', ['M', 'A'], 'asiatisch', 30, 'Mittel',
    [['haehnchenbrust', 110], ['drillinge', 110], ['gruenebohnen', 50], ['rapsoel', 4], ['knoblauch', 2], ['currypaste', 10], ['kokosmilch', 100], ['fischsauce', 5], ['zucker', 2], ['basilikum', 2], ['paratha', 70]],
    ['Kartoffeln 10 Minuten vorkochen, Bohnen die letzten 3 Minuten mitgaren.', 'Knoblauch und Currypaste im Öl 1 Minute anrösten.', 'Kokosmilch, Fischsauce und Zucker zugeben und aufkochen.', 'Hähnchen in Stücken darin 8 Minuten garziehen lassen, Gemüse zugeben.', 'Mit Thai-Basilikum bestreuen und mit warmem Roti servieren.']),
  R('chicken-fried-rice', '53367', 'Gebratener Reis mit Hähnchen', 'Wok-Reis mit Hähnchen, Ei, Karotten, Erbsen und Frühlingszwiebeln – ideal für Meal Prep.', ['M', 'A'], 'asiatisch', 25, 'Einfach',
    [['haehnchenschenkel', 110], ['jasminreis', 60], ['rapsoel', 10], ['ei', 60], ['zwiebel', 25], ['knoblauch', 3], ['ingwer', 2], ['karotte', 40], ['erbsen', 30], ['fruehlingszwiebel', 10], ['sojasauce', 10], ['sesamoel', 1]],
    ['Reis am besten am Vortag kochen und abkühlen lassen.', 'Hähnchen würfeln, salzen und im heißen Öl 5 Minuten braten.', 'Ei zugeben und zu Rührei stocken lassen.', 'Zwiebel, Knoblauch, Ingwer, Karotte und Erbsen 3 Minuten mitbraten.', 'Reis zugeben, mit Sojasauce und Sesamöl würzen und kräftig durchschwenken.'], ['mealprep']),
  R('katsu-curry', '52820', 'Chicken-Katsu-Curry mit Reis', 'Panierte Hähnchenbrust auf Reis mit milder japanischer Currysauce.', ['M', 'A'], 'asiatisch', 45, 'Mittel',
    [['haehnchenbrust', 160], ['mehl', 10], ['ei', 15], ['paniermehl', 25], ['rapsoel', 15], ['zwiebel', 50], ['knoblauch', 5], ['karotte', 40], ['gewuerze', 4], ['bruehe', 150], ['honig', 3], ['sojasauce', 6], ['reis', 70]],
    ['Für die Sauce Zwiebel, Knoblauch und Karotte anschwitzen, Mehl und Currypulver einrühren.', 'Mit Brühe ablöschen, Honig und Sojasauce zugeben und 20 Minuten köcheln, dann pürieren.', 'Hähnchen plattieren, in Mehl, Ei und Paniermehl wenden.', 'In Öl goldbraun ausbacken, in Streifen schneiden.', 'Mit Reis und Currysauce anrichten.'], ['highprotein']),
  R('haehnchen-shawarma', '53218', 'Hähnchen-Shawarma-Wrap mit Knoblauch-Joghurt', 'Orientalisch gewürzte Hähnchenbrust im Fladenbrot mit Gemüse und Kräuter-Joghurtsauce.', ['M', 'A'], 'orientalisch', 30, 'Einfach',
    [['haehnchenbrust', 180], ['knoblauch', 4], ['gewuerze', 6], ['zitrone', 8], ['olivenoel', 10], ['griechjoghurt', 60], ['tortilla', 60], ['paprika', 40], ['rotezwiebel', 20]],
    ['Hähnchen mit Knoblauch, Koriander, Kreuzkümmel, Kardamom, Paprika, Zitronensaft und Öl marinieren.', 'In der Pfanne oder auf dem Grill 6–8 Minuten braten und in Streifen schneiden.', 'Joghurt mit Knoblauch, Kreuzkümmel und Zitrone verrühren.', 'Fladenbrot mit Hähnchen, Paprika, Zwiebel und Sauce füllen und einrollen.'], ['highprotein', 'mealprep']),
  R('haehnchen-spiesse', '53264', 'Rauchige Hähnchenspieße mit Aioli', 'Hähnchenschenkel mit Fenchel, Kreuzkümmel und Räucherpaprika – gegrillt am Spieß.', ['M', 'A', 'S'], 'mediterran', 25, 'Einfach',
    [['haehnchenschenkel', 180], ['olivenoel', 8], ['gewuerze', 3], ['knoblauch', 2], ['rotweinessig', 3], ['mayonnaise', 15], ['zitrone', 10]],
    ['Hähnchen in mundgerechte Stücke schneiden.', 'Mit Öl, Fenchelsamen, Kreuzkümmel, Räucherpaprika, Knoblauch und Essig marinieren.', 'Auf Spieße stecken und 10–12 Minuten grillen, dabei wenden.', 'Mit Aioli und Zitronenspalten servieren.'], ['highprotein']),
  R('piri-piri-haehnchen', '53039', 'Piri-Piri-Hähnchen mit Süßkartoffeln & Krautsalat', 'Scharf mariniertes Hähnchen mit Süßkartoffel-Wedges und buntem Krautsalat.', ['M', 'A'], 'international', 60, 'Mittel',
    [['haehnchen', 280], ['chili', 10], ['knoblauch', 3], ['gewuerze', 3], ['rotweinessig', 8], ['rapsoel', 7], ['suesskartoffel', 200], ['rotezwiebel', 25], ['karotte', 40], ['rotebete', 35], ['kohl', 40], ['mayonnaise', 8], ['griechjoghurt', 10]],
    ['Chili, Knoblauch, Ingwer, Oregano, Paprika, Essig und Öl zu einer Paste mixen.', 'Hähnchen damit einreiben und bei 200 °C ca. 45 Minuten im Ofen garen.', 'Süßkartoffel in Spalten schneiden und mitrösten.', 'Karotte, Rote Bete, Kohl und Zwiebel fein raspeln, mit Mayonnaise, Joghurt und Essig mischen.'], ['highprotein']),
  R('pad-see-ew', '52774', 'Pad See Ew mit Hähnchen', 'Breite Reisnudeln, Hähnchen, Ei und chinesischer Brokkoli in süß-salziger Sojasauce.', ['M', 'A'], 'asiatisch', 25, 'Mittel',
    [['reisnudeln', 90], ['sojasauce', 15], ['austernsauce', 15], ['weissweinessig', 5], ['zucker', 5], ['erdnussoel', 14], ['knoblauch', 5], ['haehnchenbrust', 100], ['ei', 60], ['gailan', 180]],
    ['Nudeln einweichen, bis sie weich, aber noch bissfest sind.', 'Sojasaucen, Austernsauce, Essig, Zucker und Wasser verrühren.', 'Knoblauch und Hähnchen im heißen Wok 3 Minuten braten.', 'Brokkoli zugeben, dann Nudeln und Sauce, alles 2 Minuten schwenken.', 'Ei an den Rand schlagen, stocken lassen und unterheben.']),
  R('vietnam-haehnchensalat', '53232', 'Vietnamesischer Hähnchensalat mit Reisnudeln', 'Frischer Salat mit Glasnudeln, Hähnchen, Gurke, Karotte, Minze und Erdnüssen.', ['M'], 'asiatisch', 25, 'Einfach',
    [['reisnudeln', 50], ['karotte', 30], ['gurke', 70], ['haehnchenbrust', 115], ['radieschen', 15], ['rotezwiebel', 15], ['minze', 4], ['erdnuesse', 8], ['chili', 2], ['limette', 10], ['fischsauce', 6], ['sojasauce', 6], ['sesamoel', 6]],
    ['Hähnchen in Brühe 12 Minuten pochieren und zerzupfen.', 'Nudeln nach Packungsangabe garen und kalt abspülen.', 'Karotte, Gurke, Radieschen und Zwiebel in feine Streifen schneiden.', 'Limette, Fischsauce, Sojasauce, Sesamöl und Chili zum Dressing verrühren.', 'Alles mischen und mit Minze und gehackten Erdnüssen bestreuen.'], ['fitness', 'abnehmen']),
  R('senf-sahne-haehnchen', '53530', 'Hähnchenkeulen in Senf-Sahne-Sauce', 'Knusprig angebratene Hähnchenkeulen in cremiger Honig-Senf-Sauce.', ['M', 'A'], 'international', 45, 'Einfach',
    [['haehnchenkeule', 300], ['olivenoel', 10], ['knoblauch', 3], ['zwiebel', 20], ['bruehe', 120], ['senf', 8], ['sahne', 30], ['honig', 4], ['petersilie', 2], ['gewuerze', 2]],
    ['Keulen mit Paprika, Salz und Pfeffer würzen und im Öl rundum goldbraun braten.', 'Zwiebel und Knoblauch anschwitzen, mit Brühe ablöschen.', 'Senf, Sahne und Honig einrühren.', 'Keulen zurück in die Pfanne geben und abgedeckt 25 Minuten schmoren.', 'Mit Petersilie bestreuen.'], ['highprotein']),

  // ===================== RIND, SCHWEIN =====================
  R('spaghetti-bolognese', '52770', 'Spaghetti Bolognese', 'Der Klassiker mit magerem Rinderhack, Champignons und Tomaten.', ['M', 'A'], 'italienisch', 45, 'Einfach',
    [['spaghetti', 90], ['rinderhack', 125], ['zwiebel', 50], ['olivenoel', 4], ['knoblauch', 2], ['champignons', 22], ['gewuerze', 1], ['dosentomaten', 100], ['rinderbruehe', 75], ['tomatenmark', 4], ['worcester', 4], ['parmesan', 8]],
    ['Zwiebel und Knoblauch im Öl anschwitzen.', 'Hackfleisch zugeben und krümelig braten, Champignons mitbraten.', 'Tomaten, Brühe, Tomatenmark, Worcestersauce und Oregano einrühren, 20 Minuten köcheln.', 'Spaghetti bissfest kochen.', 'Mit der Sauce und Parmesan servieren.'], ['highprotein', 'mealprep']),
  R('rind-brokkoli-wok', '53366', 'Rindfleisch mit Brokkoli aus dem Wok', 'Zarte Rindfleischstreifen und knackiger Brokkoli in Austernsauce.', ['M', 'A'], 'asiatisch', 25, 'Einfach',
    [['rindersteak', 150], ['brokkoli', 150], ['sojasauce', 7], ['sake', 5], ['speisestaerke', 3], ['austernsauce', 10], ['bruehe', 20], ['rapsoel', 9], ['knoblauch', 3]],
    ['Rindfleisch in dünne Streifen schneiden und mit Sojasauce, Sake, Stärke und Pfeffer marinieren.', 'Austernsauce, Brühe und restliche Sojasauce verrühren.', 'Brokkoli im heißen Wok 3 Minuten braten, herausnehmen.', 'Fleisch portionsweise scharf anbraten, Knoblauch zugeben.', 'Brokkoli und Sauce zugeben und kurz eindicken lassen.'], ['highprotein', 'abnehmen']),
  R('beef-stroganoff', '52834', 'Beef Stroganoff mit Bandnudeln', 'Rinderfilet in cremiger Champignon-Senf-Sauce auf Tagliatelle.', ['M', 'A'], 'international', 30, 'Mittel',
    [['rinderfilet', 170], ['bandnudeln', 80], ['olivenoel', 4], ['zwiebel', 50], ['knoblauch', 2], ['butter', 4], ['champignons', 80], ['mehl', 4], ['cremefraiche', 50], ['senf', 5], ['rinderbruehe', 35], ['petersilie', 2]],
    ['Zwiebel und Knoblauch im Öl weich dünsten, Butter und Champignons zugeben und braten.', 'Rinderfilet in Streifen schneiden, in Mehl wenden und scharf anbraten.', 'Crème fraîche, Senf und Brühe zugeben und kurz köcheln lassen.', 'Bandnudeln bissfest kochen.', 'Mit Stroganoff und Petersilie servieren.'], ['highprotein']),
  R('lasagne', '52844', 'Lasagne al Forno', 'Klassische Lasagne mit Rinderhack-Ragù, Crème fraîche und Mozzarella.', ['M', 'A'], 'italienisch', 90, 'Mittel',
    [['lasagneplatten', 70], ['rinderhack', 85], ['olivenoel', 3], ['bacon', 12], ['zwiebel', 25], ['sellerie', 10], ['karotte', 15], ['knoblauch', 2], ['tomatenmark', 3], ['dosentomaten', 135], ['honig', 3], ['cremefraiche', 65], ['mozzarella', 20], ['parmesan', 8], ['basilikum', 1]],
    ['Bacon, Zwiebel, Sellerie und Karotte anbraten, Knoblauch und Hackfleisch zugeben.', 'Tomatenmark, Tomaten und Honig einrühren und 20 Minuten köcheln lassen.', 'Ragù, Lasagneplatten und Crème fraîche schichtweise in eine Form geben.', 'Mit Mozzarella und Parmesan abschließen.', 'Bei 180 °C 25–30 Minuten goldbraun backen.'], ['mealprep']),
  R('rinder-chili', '52826', 'Geschmortes Rinder-Chili mit Reis', 'Langsam geschmortes Rindfleisch mit Chorizo, Bohnen und mexikanischen Gewürzen.', ['M', 'A'], 'mexikanisch', 180, 'Mittel',
    [['rindergulasch', 125], ['chorizo', 35], ['zwiebel', 45], ['knoblauch', 3], ['olivenoel', 3], ['gewuerze', 4], ['balsamico', 5], ['dosentomaten', 100], ['ketchup', 4], ['braunerzucker', 4], ['borlottibohnen', 75], ['reis', 60]],
    ['Rindfleisch in großen Stücken scharf anbraten.', 'Zwiebel, Knoblauch und Chorizo zugeben, Gewürze (Kreuzkümmel, Piment, Zimt, Oregano, Ancho) kurz mitrösten.', 'Tomaten, Balsamico, Ketchup und Zucker zugeben und 2,5 Stunden schmoren.', 'Bohnen zugeben, Fleisch zerzupfen und 20 Minuten weiterköcheln.', 'Mit Reis servieren.'], ['highprotein', 'mealprep', 'muskelaufbau']),
  R('pho-bo', '53238', 'Pho Bo – Vietnamesische Rindfleischsuppe', 'Aromatische Brühe mit Sternanis und Zimt, Reisnudeln und hauchdünnem Rindfleisch.', ['M', 'A'], 'asiatisch', 45, 'Mittel',
    [['rinderbruehe', 500], ['rindersteak', 110], ['reisnudeln', 100], ['zwiebel', 50], ['ingwer', 15], ['gewuerze', 2], ['zucker', 3], ['fischsauce', 8], ['sojasauce', 11], ['fruehlingszwiebel', 15], ['chili', 3], ['basilikum', 3], ['koriander', 3], ['limette', 15]],
    ['Zwiebel und Ingwer ohne Fett rösten, mit Zimt, Sternanis, Koriandersamen und Nelken in der Brühe 30 Minuten köcheln.', 'Mit Zucker, Fischsauce und Sojasauce abschmecken, durchsieben.', 'Reisnudeln garen und in Schalen verteilen.', 'Rindfleisch hauchdünn schneiden und roh auf die Nudeln legen.', 'Mit kochender Brühe übergießen, mit Kräutern, Chili und Limette servieren.'], ['highprotein']),
  R('thai-basilikum-rind', '53199', 'Thai-Basilikum-Rind mit Reis', 'Scharf gebratenes Rinderhack mit Chili, Austernsauce und Thai-Basilikum auf Jasminreis.', ['M', 'A'], 'asiatisch', 20, 'Einfach',
    [['rinderhack', 200], ['rapsoel', 14], ['chili', 7], ['austernsauce', 15], ['basilikum', 5], ['jasminreis', 70], ['limette', 10]],
    ['Reis nach Packungsangabe garen.', 'Öl im Wok stark erhitzen, Hackfleisch darin krümelig und knusprig braten.', 'Chili und Austernsauce zugeben, 1 Minute schwenken.', 'Basilikum unterheben und mit Reis und Limette servieren.'], ['highprotein', 'muskelaufbau']),
  R('rinderfrikadellen-zwiebeln', '53125', 'Rinderfrikadellen mit karamellisierten Zwiebeln', 'Magere Rinder-Patties nach norwegischer Art (Karbonader) mit süßen Röstzwiebeln.', ['M', 'A'], 'deutsch', 30, 'Einfach',
    [['rinderhack', 150], ['zwiebel', 100], ['butter', 15], ['gewuerze', 1], ['speisestaerke', 2]],
    ['Zwiebeln in Ringe schneiden und in der Hälfte der Butter 15 Minuten langsam karamellisieren.', 'Hackfleisch mit Salz, Pfeffer, Muskat, Stärke und etwas Wasser verkneten.', 'Flache Patties formen und in der restlichen Butter je Seite 4 Minuten braten.', 'Mit den Zwiebeln servieren.'], ['highprotein', 'abnehmen']),
  R('tafelspitz', '53447', 'Tafelspitz mit Apfelkren & Schnittlauchsauce', 'Gekochtes Rindfleisch mit Wurzelgemüse, dazu Kartoffeln, Apfelmus-Kren und Schnittlauchsauce.', ['M', 'A'], 'deutsch', 180, 'Mittel',
    [['tafelspitz', 220], ['karotte', 60], ['knollensellerie', 60], ['pastinake', 40], ['lauch', 30], ['zwiebel', 40], ['petersilie', 3], ['kartoffel', 150], ['apfelmus', 50], ['schmand', 30], ['schnittlauch', 3]],
    ['Tafelspitz in einen Topf geben, mit Wasser bedecken und aufkochen, Schaum abschöpfen.', 'Halbierte, angeröstete Zwiebel, Lorbeer und Pfefferkörner zugeben und 2,5 Stunden sieden lassen.', 'Wurzelgemüse die letzten 30 Minuten mitgaren.', 'Kartoffeln kochen, Apfelmus mit etwas Meerrettich und Schmand mit Schnittlauch verrühren.', 'Fleisch gegen die Faser aufschneiden und mit Beilagen servieren.'], ['highprotein']),
  R('rindergulasch', '53057', 'Rindergulasch', 'Kräftig geschmortes Gulasch mit Zwiebeln, Karotten, Rotwein und Senf.', ['M', 'A'], 'deutsch', 150, 'Mittel',
    [['rindergulasch', 165], ['zwiebel', 65], ['karotte', 50], ['knoblauch', 3], ['rotwein', 65], ['senf', 15], ['gewuerze', 2], ['rapsoel', 7]],
    ['Fleisch würfeln und im Öl portionsweise kräftig anbraten.', 'Zwiebeln, Karotten und Knoblauch zugeben und mitbraten.', 'Mit Rotwein ablöschen, Senf, Paprika, Lorbeer und Wasser zugeben.', 'Zugedeckt 2 Stunden schmoren, bis das Fleisch zart ist.'], ['highprotein', 'mealprep']),
  R('frikadellen', '53553', 'Frikadellen (Fleischbällchen)', 'Saftige Fleischbällchen aus Schweinehack, Zwiebel und Haferflocken, in Butter gebraten.', ['M', 'A', 'S'], 'deutsch', 30, 'Einfach',
    [['schweinehack', 125], ['zwiebel', 50], ['knoblauch', 2], ['mehl', 3], ['haferflocken', 3], ['milch', 30], ['ei', 15], ['gewuerze', 1], ['butter', 7]],
    ['Zwiebel und Knoblauch fein reiben.', 'Mit Hackfleisch, Mehl, Haferflocken, Milch, Ei, Salz und Pfeffer zu einem weichen Teig verrühren.', 'Mit einem nassen Löffel Bällchen formen.', 'In Butter rundum 8–10 Minuten braun braten.'], ['mealprep']),
  R('schweinegulasch-sauerkraut', '53301', 'Szegediner Schweinegulasch mit Sauerkraut', 'Deftiges Gulasch aus Schweinenacken mit Sauerkraut, Paprika und Sahne.', ['M', 'A'], 'deutsch', 120, 'Mittel',
    [['schweinenacken', 200], ['schmalz', 10], ['zwiebel', 100], ['gewuerze', 3], ['knoblauch', 3], ['mehl', 5], ['rinderbruehe', 250], ['sauerkraut', 100], ['sahne', 50], ['schmand', 15]],
    ['Zwiebeln im Schmalz goldgelb braten, Kümmel zugeben.', 'Fleischwürfel und Knoblauch zugeben und anbraten.', 'Mehl und Paprika darüberstäuben, mit Brühe ablöschen, Lorbeer zugeben und 1 Stunde schmoren.', 'Sauerkraut zugeben und 30 Minuten weiterköcheln.', 'Sahne einrühren und mit einem Klecks Schmand servieren.']),
  R('gruenkohl-stampf', '52980', 'Grünkohl-Stampf mit Räucherwurst', 'Kartoffelstampf mit Grünkohl und geräucherter Wurst – deftige Hausmannskost.', ['M', 'A'], 'deutsch', 40, 'Einfach',
    [['kartoffel', 375], ['gruenkohl', 190], ['bratwurst', 100], ['schalotte', 15], ['butter', 10], ['milch', 125], ['gewuerze', 1]],
    ['Kartoffeln mit Lorbeer in Salzwasser 20 Minuten kochen.', 'Grünkohl die letzten 10 Minuten mitgaren, Wurst im Wasser erwärmen.', 'Schalotten in Butter anschwitzen.', 'Alles abgießen, mit warmer Milch und Schalotten grob stampfen, mit Muskat würzen.', 'Mit der Wurst servieren.']),
  R('tonkatsu', '53032', 'Tonkatsu mit Krautsalat', 'Japanisches paniertes Schweinekotelett mit Tonkatsu-Sauce und fein gehobeltem Kohl.', ['M', 'A'], 'asiatisch', 30, 'Mittel',
    [['schweinekotelett', 180], ['mehl', 15], ['ei', 25], ['paniermehl', 25], ['rapsoel', 15], ['ketchup', 8], ['worcester', 8], ['austernsauce', 4], ['zucker', 4], ['kohl', 60]],
    ['Koteletts leicht plattieren, salzen und pfeffern.', 'In Mehl, Ei und Panko-Paniermehl wenden.', 'In Öl bei 170 °C 5–6 Minuten goldbraun frittieren.', 'Ketchup, Worcestersauce, Austernsauce und Zucker zur Sauce verrühren.', 'In Streifen schneiden und mit fein gehobeltem Kohl servieren.'], ['highprotein']),
  R('aussie-burger', '53099', 'Aussie-Burger mit Spiegelei & Roter Bete', 'Saftiger Rindfleisch-Burger mit Spiegelei, Roter Bete, Tomate und Salat.', ['M', 'A'], 'international', 25, 'Einfach',
    [['rinderhack', 150], ['burgerbroetchen', 75], ['ei', 60], ['rotebete', 30], ['tomate', 40], ['salat', 15], ['zwiebel', 15], ['rapsoel', 3]],
    ['Hackfleisch salzen, pfeffern und zu einem flachen Patty formen.', 'Patty auf dem Grill oder in der Pfanne je Seite 3–4 Minuten braten.', 'Spiegelei braten, Brötchen toasten.', 'Brötchen mit Salat, Patty, Ei, Roter Bete, Tomate und Zwiebel belegen.'], ['highprotein', 'muskelaufbau']),

  // ===================== FISCH & MEERESFRÜCHTE =====================
  R('teriyaki-lachs', '52773', 'Honig-Teriyaki-Lachs mit Sesam', 'Lachsfilet in glänzender Teriyaki-Glasur mit gerösteten Sesamsamen.', ['M', 'A'], 'asiatisch', 20, 'Einfach',
    [['lachs', 150], ['olivenoel', 5], ['sojasauce', 10], ['sake', 10], ['honig', 5], ['sesam', 9], ['fruehlingszwiebel', 5]],
    ['Sojasauce, Sake und Honig verrühren und den Lachs darin 15 Minuten marinieren.', 'Lachs in Öl auf der Hautseite 4 Minuten braten, wenden.', 'Marinade zugeben und den Lachs damit glasieren, bis die Sauce sirupartig ist.', 'Mit Sesam und Frühlingszwiebeln bestreuen.'], ['highprotein', 'abnehmen']),
  R('ofenlachs-fenchel', '52959', 'Ofenlachs mit Fenchel & Kirschtomaten', 'Lachs auf Ofenfenchel mit Kirschtomaten, Zitrone und Oliven.', ['M', 'A'], 'mediterran', 35, 'Einfach',
    [['lachs', 175], ['fenchel', 250], ['petersilie', 4], ['zitrone', 25], ['kirschtomate', 90], ['olivenoel', 7], ['oliven', 15]],
    ['Ofen auf 200 °C vorheizen. Fenchel in Scheiben schneiden und mit Öl, Zitronensaft und Petersilie mischen.', 'Fenchel 10 Minuten vorrösten.', 'Lachs und Tomaten daraufsetzen und 15 Minuten garen.', 'Mit Oliven und Zitronenscheiben servieren.'], ['highprotein', 'abnehmen']),
  R('lachs-avocado-salat', '52960', 'Lachs-Avocado-Salat mit Minze', 'Gebratener Lachs auf Spinat mit Avocado, Gurke und Limetten-Honig-Dressing.', ['M', 'A'], 'mediterran', 20, 'Einfach',
    [['lachs', 100], ['avocado', 100], ['gurke', 100], ['spinat', 100], ['minze', 3], ['limette', 10], ['honig', 3], ['olivenoel', 10]],
    ['Lachs auf der Hautseite knusprig braten, wenden und kurz fertig garen.', 'Limettensaft, Honig, Olivenöl und Minze zu einem Dressing verrühren.', 'Spinat, Avocado und Gurke auf Tellern verteilen.', 'Lachs darauflegen und mit Dressing beträufeln.'], ['fitness']),
  R('salade-nicoise', '52852', 'Salade Niçoise mit Thunfischsteak', 'Rosa gebratener Thunfisch mit Kartoffeln, Ei, grünen Bohnen, Tomaten und Kapern.', ['M', 'A'], 'mediterran', 30, 'Mittel',
    [['thunfischsteak', 130], ['kartoffel', 110], ['ei', 60], ['gruenebohnen', 60], ['tomate', 80], ['kapern', 7], ['rotezwiebel', 15], ['spinat', 25], ['olivenoel', 12], ['rotweinessig', 4]],
    ['Kartoffeln kochen, Bohnen die letzten 4 Minuten mitgaren. Eier 7 Minuten kochen.', 'Olivenöl, Essig und Kapern zu einer Vinaigrette rühren.', 'Thunfisch würzen und von jeder Seite 1–2 Minuten scharf anbraten.', 'Salat, Kartoffeln, Bohnen, Tomaten, Zwiebel und halbierte Eier anrichten.', 'Thunfisch aufschneiden, darauflegen und mit Vinaigrette beträufeln.'], ['highprotein', 'fitness']),
  R('garnelen-wok', '53200', 'Garnelen-Wok mit Reisnudeln', 'Thai-Garnelen mit Paprika, Sprossen und Wasserkastanien in Limetten-Fischsauce.', ['M', 'A'], 'asiatisch', 20, 'Einfach',
    [['garnelen', 200], ['reisnudeln', 60], ['chili', 5], ['knoblauch', 8], ['koriander', 8], ['zucker', 6], ['limette', 15], ['fischsauce', 15], ['erdnussoel', 10], ['ingwer', 8], ['fruehlingszwiebel', 15], ['paprika', 80], ['wasserkastanien', 40], ['sprossen', 50], ['sojasauce', 8]],
    ['Chili, Knoblauch, Koriander, Zucker, Limettensaft und Fischsauce zu einer Sauce mixen.', 'Nudeln einweichen.', 'Ingwer, Frühlingszwiebel und Paprika im heißen Öl 2 Minuten braten.', 'Garnelen zugeben, bis sie rosa sind, dann Wasserkastanien, Sprossen und Nudeln.', 'Sauce und Sojasauce unterschwenken und sofort servieren.'], ['highprotein', 'abnehmen']),
  R('pad-thai', '53191', 'Pad Thai mit Garnelen', 'Gebratene Reisnudeln mit Garnelen, Sprossen, Limette und gerösteten Erdnüssen.', ['M', 'A'], 'asiatisch', 25, 'Mittel',
    [['reisnudeln', 65], ['garnelen', 100], ['limette', 30], ['gewuerze', 1], ['braunerzucker', 5], ['fischsauce', 15], ['rapsoel', 10], ['fruehlingszwiebel', 20], ['sprossen', 70], ['erdnuesse', 12], ['koriander', 3], ['sweetchili', 10]],
    ['Nudeln nach Packungsangabe einweichen.', 'Limettensaft, Cayennepfeffer, Zucker und Fischsauce verrühren.', 'Garnelen im heißen Öl 2 Minuten braten.', 'Nudeln, Sauce, Frühlingszwiebeln und Sprossen zugeben und durchschwenken.', 'Mit Erdnüssen, Koriander und Limettenspalten servieren.']),
  R('fisch-tacos', '52819', 'Cajun-Fisch-Tacos mit Avocado', 'Würziger Weißfisch in Tortillas mit Avocado, Salat, Salsa und Sour Cream.', ['M', 'A'], 'mexikanisch', 20, 'Einfach',
    [['weisserfisch', 125], ['gewuerze', 4], ['rapsoel', 2], ['tortilla', 80], ['avocado', 40], ['salat', 40], ['fruehlingszwiebel', 15], ['salsa', 75], ['schmand', 35], ['zitrone', 10], ['knoblauch', 1]],
    ['Fisch mit Cajun-Gewürz, Cayenne, Knoblauch und Zitronensaft marinieren.', 'In einer heißen Pfanne mit wenig Öl je Seite 3 Minuten braten und zerpflücken.', 'Tortillas kurz erwärmen.', 'Mit Salat, Fisch, Avocado, Frühlingszwiebeln, Salsa und Sour Cream füllen.'], ['fitness']),

  // ===================== VEGETARISCH & VEGAN =====================
  R('kichererbsen-fajitas', '52870', 'Kichererbsen-Fajitas mit Avocado', 'Geröstete Harissa-Kichererbsen mit Tomatensalsa, Avocado und Sour Cream in Tortillas.', ['M', 'A'], 'mexikanisch', 20, 'Einfach',
    [['kichererbsen', 100], ['olivenoel', 4], ['gewuerze', 1], ['tomate', 60], ['rotezwiebel', 25], ['rotweinessig', 3], ['avocado', 40], ['limette', 8], ['schmand', 25], ['harissa', 3], ['tortilla', 60], ['koriander', 2]],
    ['Kichererbsen mit Öl und Paprika in der Pfanne 10 Minuten knusprig rösten.', 'Tomate und Zwiebel würfeln und mit Essig marinieren.', 'Avocado mit Limettensaft zerdrücken, Sour Cream mit Harissa verrühren.', 'Tortillas erwärmen und alles darauf verteilen, mit Koriander bestreuen.'], ['vegetarisch']),
  R('dal-fry', '52785', 'Dal Fry mit Fladenbrot', 'Indisches Linsengericht mit Tomate, Ghee und gerösteten Gewürzen, dazu Fladenbrot.', ['M', 'A'], 'indisch', 40, 'Einfach',
    [['toordal', 50], ['gewuerze', 2], ['ghee', 10], ['tomate', 45], ['chili', 2], ['ingwer', 2], ['koriander', 2], ['zucker', 1], ['naan', 45]],
    ['Linsen waschen und mit Wasser, Salz und Kurkuma 25 Minuten weich kochen.', 'Ghee erhitzen, Kreuzkümmel, Senfsaat und Lorbeer darin anrösten.', 'Tomate, Chili und Ingwer zugeben und 5 Minuten schmoren.', 'Linsen unterrühren, mit Garam Masala abschmecken und mit Koriander servieren.', 'Dazu warmes Fladenbrot reichen.'], ['vegetarisch']),
  R('matar-paneer', '52865', 'Matar Paneer mit Naan', 'Indischer Frischkäse mit Erbsen in würziger Tomatensauce.', ['M', 'A'], 'indisch', 30, 'Einfach',
    [['paneer', 56], ['rapsoel', 4], ['ingwer', 5], ['gewuerze', 3], ['chili', 3], ['tomate', 120], ['erbsen', 38], ['koriander', 3], ['naan', 90]],
    ['Paneer würfeln und im Öl goldbraun braten, herausnehmen.', 'Ingwer, Kreuzkümmel, Kurkuma und Koriander kurz anrösten.', 'Chili und gehackte Tomaten zugeben und 10 Minuten einkochen.', 'Erbsen und Paneer zugeben, 5 Minuten köcheln, mit Garam Masala abschmecken.', 'Mit Koriander und warmem Naan servieren.'], ['vegetarisch']),
  R('ratatouille', '52908', 'Ratatouille', 'Provenzalisches Schmorgemüse aus Aubergine, Zucchini, Paprika und Tomaten.', ['M', 'A'], 'mediterran', 60, 'Einfach',
    [['aubergine', 150], ['zucchini', 250], ['paprikagelb', 80], ['tomate', 120], ['olivenoel', 15], ['basilikum', 3], ['zwiebel', 25], ['knoblauch', 4], ['rotweinessig', 1], ['zucker', 1]],
    ['Gemüse in mundgerechte Stücke schneiden.', 'Aubergine, Zucchini und Paprika portionsweise im Öl anbraten.', 'Zwiebel und Knoblauch anschwitzen, Tomaten zugeben.', 'Gesamtes Gemüse zugeben und 30 Minuten sanft schmoren.', 'Mit Essig, Zucker und Basilikum abschmecken.'], ['vegan', 'abnehmen', 'mealprep']),
  R('falafel', '53266', 'Falafel', 'Knusprige Kichererbsen-Bällchen mit Kreuzkümmel, Koriander und Petersilie.', ['M', 'S'], 'orientalisch', 30, 'Mittel',
    [['kichererbsen', 135], ['rapsoel', 7], ['zwiebel', 35], ['knoblauch', 2], ['gewuerze', 2], ['petersilie', 5], ['ei', 20]],
    ['Zwiebel und Knoblauch in etwas Öl weich dünsten.', 'Mit Kichererbsen, Gewürzen, Petersilie und Ei grob pürieren.', 'Kleine Bällchen formen und leicht flach drücken.', 'Im restlichen Öl von beiden Seiten 3 Minuten goldbraun braten.'], ['vegetarisch']),
  R('penne-arrabiata', '52771', 'Penne all\'Arrabbiata', 'Scharfe Tomatensauce mit Knoblauch und Chiliflocken auf Penne.', ['M', 'A'], 'italienisch', 20, 'Einfach',
    [['penne', 110], ['olivenoel', 13], ['knoblauch', 4], ['dosentomaten', 100], ['chili', 1], ['gewuerze', 1], ['basilikum', 1], ['parmesan', 8]],
    ['Penne in reichlich Salzwasser bissfest kochen.', 'Knoblauch im Olivenöl goldgelb anbraten.', 'Tomaten, Chiliflocken und italienische Kräuter zugeben und 10 Minuten köcheln.', 'Penne untermischen und mit Basilikum und Parmesan servieren.'], ['vegetarisch']),
  R('gefuellte-paprika-quinoa', '53067', 'Gefüllte Paprika mit Quinoa & schwarzen Bohnen', 'Rote Paprika gefüllt mit würzigem Quinoa, Bohnen, Mais und überbackenem Käse.', ['M', 'A'], 'mexikanisch', 50, 'Mittel',
    [['paprika', 160], ['olivenoel', 3], ['zwiebel', 15], ['knoblauch', 2], ['quinoa', 42], ['schwarzebohnen', 60], ['mais', 40], ['dosentomaten', 100], ['gewuerze', 2], ['reibekaese', 40], ['koriander', 2]],
    ['Quinoa garen. Ofen auf 190 °C vorheizen.', 'Zwiebel und Knoblauch anschwitzen, Bohnen, Mais, Tomaten und Gewürze zugeben.', 'Quinoa und die Hälfte des Käses untermischen.', 'Paprika halbieren, füllen, mit restlichem Käse bestreuen.', '25 Minuten backen, mit Koriander servieren.'], ['vegetarisch', 'mealprep']),
  R('tofu-cashew-wok', '53240', 'Tofu-Gemüse-Wok mit Cashews', 'Marinierter Tofu mit Brokkoli, Pak Choi, Edamame und Cashews in Hoisinsauce.', ['M', 'A'], 'asiatisch', 20, 'Einfach',
    [['tofu', 150], ['rapsoel', 7], ['brokkoli', 170], ['knoblauch', 6], ['chili', 4], ['fruehlingszwiebel', 30], ['edamame', 70], ['pakchoi', 125], ['karotte', 40], ['hoisin', 11], ['sojasauce', 8], ['cashews', 12]],
    ['Tofu würfeln und im Öl rundum knusprig braten, herausnehmen.', 'Brokkoli, Karotte, Knoblauch und Chili 3 Minuten pfannenrühren.', 'Frühlingszwiebeln, Edamame und Pak Choi zugeben und 2 Minuten garen.', 'Tofu, Hoisin- und Sojasauce zugeben und durchschwenken.', 'Mit gerösteten Cashews bestreuen.'], ['vegan', 'highprotein', 'fitness']),
  R('linsen-chili-kuerbis', '52784', 'Rauchiges Linsen-Chili mit Kürbis', 'Wärmendes Chili aus braunen Linsen, Kürbis und Tomaten mit Cashew-Creme.', ['M', 'A'], 'mexikanisch', 50, 'Einfach',
    [['linsenbraun', 70], ['kuerbis', 150], ['olivenoel', 3], ['zwiebel', 25], ['lauch', 40], ['knoblauch', 3], ['gewuerze', 4], ['kakao', 1], ['dosentomaten', 100], ['karotte', 50], ['cashews', 25], ['rotweinessig', 2]],
    ['Zwiebel, Lauch und Knoblauch im Öl anschwitzen.', 'Kreuzkümmel, Koriander, Räucherpaprika, Zimt, Chili, Kakao und Oregano kurz mitrösten.', 'Tomaten, Wasser, Karotten, Linsen und Kürbis zugeben und 35 Minuten köcheln.', 'Cashews mit Wasser und Essig zu einer Creme mixen.', 'Chili mit einem Klecks Cashew-Creme servieren.'], ['vegan', 'mealprep', 'abnehmen']),
  R('yaki-udon', '52871', 'Yaki Udon mit Shiitake', 'Gebratene Udon-Nudeln mit Weißkohl, Shiitake und Frühlingszwiebeln.', ['M', 'A'], 'asiatisch', 20, 'Einfach',
    [['udon', 200], ['sesamoel', 10], ['zwiebel', 50], ['kohl', 150], ['shiitake', 50], ['fruehlingszwiebel', 30], ['mirin', 30], ['sojasauce', 15], ['zucker', 6], ['worcester', 7]],
    ['Mirin, Sojasauce, Zucker und Worcestersauce verrühren.', 'Zwiebel, Kohl und Shiitake im Sesamöl 4 Minuten braten.', 'Udon-Nudeln und Frühlingszwiebeln zugeben.', 'Sauce darübergeben und alles 2 Minuten durchschwenken.']),
  R('kaspressknoedel', '53445', 'Kaspressknödel in Rinderbrühe', 'Tiroler Käseknödel aus Brot, Bergkäse und Kartoffeln – in kräftiger Brühe serviert.', ['M', 'A'], 'deutsch', 45, 'Mittel',
    [['broetchen', 63], ['bergkaese', 63], ['ei', 30], ['petersilie', 2], ['kartoffel', 110], ['mehl', 25], ['milch', 63], ['zwiebel', 15], ['butter', 10], ['rinderbruehe', 300]],
    ['Brot würfeln, Kartoffeln kochen und zerdrücken.', 'Brot, Kartoffeln, geriebenen Käse, Eier, Mehl, Milch, Zwiebel und Petersilie verkneten.', 'Flache Knödel formen und in Butter von beiden Seiten goldbraun braten.', 'In heißer Rinderbrühe servieren.']),
  R('nudelsalat-mediterran', '52777', 'Mediterraner Nudelsalat mit Thunfisch', 'Farfalle mit Mozzarella, Kirschtomaten, Oliven, Thunfisch und Basilikum.', ['M', 'S'], 'italienisch', 20, 'Einfach',
    [['farfalle', 85], ['mozzarella', 50], ['kirschtomate', 60], ['basilikum', 4], ['olivenoel', 11], ['oliven', 10], ['thunfisch', 50]],
    ['Farfalle bissfest kochen und kalt abschrecken.', 'Tomaten halbieren, Mozzarella abtropfen lassen.', 'Alles mit Oliven, Thunfisch und Olivenöl mischen.', 'Mit Salz, Pfeffer und Basilikum abschmecken.'], ['mealprep']),
  R('vegane-lasagne', '52775', 'Vegane Linsen-Lasagne', 'Lasagne mit roten Linsen, Gemüse und Spinat, überbacken mit veganer Béchamel.', ['M', 'A'], 'italienisch', 75, 'Mittel',
    [['linsenrot', 50], ['karotte', 20], ['zwiebel', 25], ['zucchini', 40], ['koriander', 1], ['spinat', 40], ['lasagneplatten', 50], ['veganebutter', 9], ['mehl', 8], ['sojamilch', 75], ['senf', 2], ['weissweinessig', 1]],
    ['Linsen mit Zwiebel, Karotte und Zucchini 20 Minuten köcheln.', 'Für die Béchamel Margarine schmelzen, Mehl anschwitzen, Sojamilch einrühren, mit Senf und Essig abschmecken.', 'Linsen, Spinat und Lasagneplatten in eine Form schichten.', 'Mit Béchamel abschließen und bei 180 °C 30 Minuten backen.'], ['vegan', 'mealprep']),
  R('vegan-banh-mi', '53250', 'Veganes Bánh Mì mit Tempeh', 'Knuspriges Baguette mit Hummus, gebratenem Tempeh, eingelegtem Gemüse und Kräutern.', ['M', 'S'], 'asiatisch', 25, 'Einfach',
    [['baguette', 125], ['tempeh', 88], ['hummus', 50], ['rohkost', 75], ['weissweinessig', 22], ['zucker', 3], ['koriander', 3], ['minze', 2], ['hotsauce', 5]],
    ['Gemüse in feine Streifen schneiden und 15 Minuten in Essig und Zucker einlegen.', 'Tempeh in Scheiben schneiden und goldbraun braten.', 'Baguette aufschneiden und mit Hummus bestreichen.', 'Mit Tempeh, Gemüse, Kräutern und Hot Sauce füllen.'], ['vegan']),
  R('chili-sin-carne', '52867', 'Vegetarisches Chili mit Ofengemüse', 'Schnelles Chili aus Ofengemüse, Kidneybohnen, Tomaten und Getreide.', ['M', 'A'], 'mexikanisch', 30, 'Einfach',
    [['ofengemuese', 200], ['kidneybohnen', 120], ['dosentomaten', 200], ['quinoa', 30], ['gewuerze', 3], ['zwiebel', 15]],
    ['Ofengemüse bei 200 °C 20 Minuten rösten.', 'Mit Bohnen, Tomaten und Gewürzen in einen Topf geben und 10 Minuten köcheln.', 'Gegarten Quinoa unterrühren.', 'Mit Zwiebelringen bestreut servieren.'], ['vegan', 'abnehmen', 'mealprep']),

  // ===================== DESSERTS & SNACKS =====================
  R('schoko-avocado-mousse', '52853', 'Schoko-Avocado-Mousse', 'Cremige Mousse aus Avocado, Banane und Kakao – gesüßt mit Honig, getoppt mit Himbeeren.', ['D', 'S'], 'international', 10, 'Einfach',
    [['avocado', 85], ['banane', 60], ['kakao', 10], ['honig', 15], ['zitrone', 2], ['vanille', 1], ['himbeeren', 20]],
    ['Avocado und Banane schälen.', 'Mit Kakao, Honig, Zitronensaft, Vanille, 2 EL Wasser und einer Prise Salz cremig pürieren.', 'In Gläser füllen und 30 Minuten kühlen.', 'Mit Himbeeren servieren.'], ['vegetarisch']),
  R('honig-joghurt-cheesecake', '53007', 'Griechischer Honig-Joghurt-Cheesecake', 'Gebackener Käsekuchen mit Mascarpone, griechischem Joghurt und Honig auf Mandelboden.', ['D'], 'mediterran', 90, 'Mittel',
    [['butterkekse', 10], ['mandeln', 8], ['butter', 8], ['griechjoghurt', 25], ['mascarpone', 75], ['ei', 12], ['honig', 30], ['beerenmix', 30]],
    ['Kekse und Mandeln fein mahlen, mit Butter mischen und in eine Springform drücken.', 'Mascarpone, Joghurt, Eier, Zitronen- und Orangenabrieb und Honig glatt rühren.', 'Auf den Boden geben und bei 160 °C 60 Minuten backen.', 'Im Ofen abkühlen lassen und mit Früchten servieren.']),
  R('quark-rhabarber-kuchen', '53574', 'Quark-Rhabarber-Hefekuchen', 'Luftiger Hefeteig mit süßem Quark und Rhabarberstücken.', ['D', 'S'], 'deutsch', 90, 'Mittel',
    [['mehl', 22], ['milch', 12], ['hefe', 1], ['zucker', 6], ['ei', 7], ['butter', 3], ['magerquark', 25], ['rhabarber', 15], ['gewuerze', 0.5]],
    ['Hefe in lauwarmer Milch mit Zucker auflösen.', 'Mit Mehl, Ei, Butter, Salz und Kardamom zu einem Teig kneten und 1 Stunde gehen lassen.', 'Teig ausrollen, mit gesüßtem Quark bestreichen und mit Rhabarber belegen.', 'Mit Zimt und Zucker bestreuen und bei 200 °C 20 Minuten backen.']),
  R('apfel-brombeer-crumble', '52893', 'Apfel-Brombeer-Crumble', 'Warme Äpfel und Brombeeren unter knusprigen Butterstreuseln.', ['D'], 'international', 45, 'Einfach',
    [['apfel', 75], ['brombeeren', 30], ['mehl', 30], ['zucker', 15], ['butter', 22], ['braunerzucker', 8]],
    ['Mehl, Zucker und Butter zu Streuseln verreiben und auf einem Blech 15 Minuten vorbacken.', 'Äpfel würfeln und in Butter mit braunem Zucker und Zimt 3 Minuten karamellisieren.', 'Brombeeren unterheben und alles in eine Form geben.', 'Streusel darüber verteilen und bei 190 °C 15 Minuten backen.']),
  R('himbeer-mousse', '53303', 'Himbeermousse', 'Luftige Mousse aus pürierten Himbeeren und geschlagener Sahne.', ['D'], 'international', 20, 'Einfach',
    [['himbeeren', 58], ['zucker', 10], ['zitrone', 5], ['sahne', 83], ['gelatine', 0.7]],
    ['Gelatine in kaltem Wasser einweichen.', 'Himbeeren mit Zucker und Zitronensaft pürieren und durch ein Sieb streichen.', 'Gelatine ausdrücken, auflösen und unter das Püree rühren.', 'Sahne steif schlagen und unterheben.', 'In Gläser füllen und 3 Stunden kühlen.']),
  R('erdbeeren-romanoff', '53082', 'Erdbeeren Romanoff', 'Marinierte Erdbeeren mit Orangenlikör unter einer Haube aus Sahne und Sauerrahm.', ['D'], 'international', 15, 'Einfach',
    [['erdbeeren', 150], ['zucker', 12], ['grandmarnier', 15], ['sahne', 60], ['schmand', 15]],
    ['Erdbeeren vierteln und mit Zucker und Orangenlikör 30 Minuten marinieren.', 'Sahne steif schlagen und Sauerrahm unterheben.', 'Erdbeeren in Gläser füllen und mit der Creme toppen.']),
  R('erdnussbutter-cookies', '52958', 'Erdnussbutter-Cookies', 'Nur drei Zutaten: Erdnussbutter, Zucker und Ei – mürbe und nussig.', ['D', 'S'], 'international', 20, 'Einfach',
    [['erdnussbutter', 31], ['zucker', 12], ['ei', 7]],
    ['Ofen auf 180 °C vorheizen.', 'Erdnussbutter, Zucker und Ei glatt rühren.', 'Kleine Kugeln formen, auf ein Blech setzen und mit einer Gabel ein Gittermuster eindrücken.', '10–12 Minuten backen und auf dem Blech abkühlen lassen.'], ['vegetarisch']),
  R('baba-ghanoush', '53094', 'Baba Ghanoush mit Pitabrot', 'Rauchige Auberginencreme mit Tahini, Zitrone und Knoblauch, dazu Pita-Ecken.', ['S', 'M'], 'orientalisch', 50, 'Einfach',
    [['aubergine', 230], ['knoblauch', 2], ['zitrone', 8], ['tahini', 8], ['olivenoel', 7], ['griechjoghurt', 5], ['minze', 1], ['petersilie', 2], ['pita', 40]],
    ['Auberginen im Ofen oder über der Flamme rösten, bis die Haut schwarz und das Innere weich ist.', 'Fruchtfleisch herauslöffeln und abtropfen lassen.', 'Mit Knoblauch, Zitronensaft, Tahini, Olivenöl und Joghurt grob zerdrücken.', 'Mit Kräutern, Cayenne und Olivenöl garnieren, mit Pita servieren.'], ['vegetarisch']),
]

export const MEAL_TYPES = { F: 'Frühstück', M: 'Mittagessen', A: 'Abendessen', S: 'Snack', D: 'Dessert' }
export const CUISINES = {
  deutsch: 'Deutsche Küche', italienisch: 'Italienische Küche', asiatisch: 'Asiatische Küche',
  mediterran: 'Mediterran', mexikanisch: 'Mexikanisch', indisch: 'Indisch', orientalisch: 'Orientalisch', international: 'International',
}

export const RECIPE_CATEGORIES = [
  { id: 'F', label: 'Frühstück', emoji: '🍳' },
  { id: 'M', label: 'Mittagessen', emoji: '🥗' },
  { id: 'A', label: 'Abendessen', emoji: '🍽️' },
  { id: 'S', label: 'Snacks', emoji: '🥨' },
  { id: 'D', label: 'Desserts', emoji: '🍰' },
  { id: 'highprotein', label: 'High Protein', emoji: '💪' },
  { id: 'muskelaufbau', label: 'Muskelaufbau', emoji: '🏋️' },
  { id: 'abnehmen', label: 'Abnehmen', emoji: '📉' },
  { id: 'vegetarisch', label: 'Vegetarisch', emoji: '🥕' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'fitness', label: 'Fitness-Rezepte', emoji: '⚡' },
  { id: 'deutsch', label: 'Deutsche Küche', emoji: '🥨' },
  { id: 'italienisch', label: 'Italienische Küche', emoji: '🍝' },
  { id: 'asiatisch', label: 'Asiatische Küche', emoji: '🥢' },
  { id: 'mealprep', label: 'Meal Prep', emoji: '📦' },
]

function sumNutrition(ingredients, factor = 1) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 }
  for (const [key, g] of ingredients) {
    const n = nutrientsFor(key, g * factor)
    for (const k in t) t[k] += n[k]
  }
  return t
}

export function enrich(r) {
  const per = sumNutrition(r.ingredients)
  const foods = r.ingredients.map(([k]) => FOODS[k]).filter(Boolean)
  const vegan = foods.every(f => f.vegan)
  const vegetarian = foods.every(f => f.vegetarian)
  const tags = new Set(r.tags)
  if (vegan) { tags.add('vegan'); tags.add('vegetarisch') } else { tags.delete('vegan') }
  if (vegetarian) tags.add('vegetarisch'); else tags.delete('vegetarisch')
  const proteinShare = per.kcal > 0 ? (per.p * 4) / per.kcal : 0
  if (per.p >= 30 || (proteinShare >= 0.3 && per.p >= 20)) tags.add('highprotein')
  if (per.p >= 40 && per.kcal >= 550) tags.add('muskelaufbau')
  if (per.kcal <= 550 && proteinShare >= 0.25) tags.add('abnehmen')
  if (proteinShare >= 0.3 && per.kcal <= 700) tags.add('fitness')
  if (['deutsch', 'italienisch', 'asiatisch'].includes(r.cuisine)) tags.add(r.cuisine)
  const diet = vegan ? 'vegan' : vegetarian ? 'vegetarisch' : 'alles'
  const img = MEAL_IMAGES[r.mealId]
  return {
    ...r,
    image: img ? (STATIC ? `img/m/${r.mealId}.jpg` : img.url) : null,
    custom: !!r.custom,
    imageTitle: img ? img.name : null,
    nutrition: per,
    tags: [...tags],
    diet,
    mainFoods: [...r.ingredients].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
  }
}

export const RECIPES = RAW.map(enrich)
export const RECIPE_MAP = Object.fromEntries(RECIPES.map(r => [r.id, r]))

export function scaledNutrition(recipe, persons) {
  return sumNutrition(recipe.ingredients, persons)
}

export function recipeHasDislike(recipe, dislikes) {
  if (!dislikes?.length) return false
  return recipe.ingredients.some(([k]) => dislikes.some(d => foodMatchesDislike(k, d)))
}

export function imageUrl(recipe, size) {
  if (!recipe?.image) return null
  return size && !STATIC ? `${recipe.image}/${size}` : recipe.image
}
