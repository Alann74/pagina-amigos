// Datos curiosos para la sala de espera. Cada uno se verificó contra la fuente enlazada.
// Cuando las fuentes difieren, el texto lo dice (aprox., "casi", etc.).
export interface Fact { text: string; source: string; url: string }

export const FACTS: Fact[] = [
  { text: "En Venus un día dura más que un año: gira sobre sí misma una vez cada ~243 días terrestres y da la vuelta al Sol en ~225.", source: "NASA Space Place", url: "https://spaceplace.nasa.gov/all-about-venus/en/" },
  { text: "Saturno es el único planeta del sistema solar menos denso que el agua. Flotaría… si existiera una pileta lo bastante grande.", source: "NASA StarChild", url: "https://starchild.gsfc.nasa.gov/docs/StarChild/solar_system_level2/saturn.html" },
  { text: "Un pulpo tiene tres corazones y sangre azul: usa cobre (no hierro) para transportar el oxígeno.", source: "Smithsonian Magazine", url: "https://www.smithsonianmag.com/science-nature/ten-wild-facts-about-octopuses-they-have-three-hearts-big-brains-and-blue-blood-7625828/" },
  { text: "Cleopatra vivió más cerca en el tiempo del alunizaje que de la construcción de la Gran Pirámide: unos 2.000 años la separan de 1969 y unos 2.500 de la pirámide.", source: "WorldAtlas", url: "https://www.worldatlas.com/articles/so-cleopatra-lived-closer-in-time-to-the-first-lunar-landing-than-the-great-pyramids.html" },
  { text: "La miel casi no se echa a perder si está bien guardada: tiene muy poca agua y es muy ácida, así que a las bacterias les cuesta vivir ahí.", source: "Smithsonian Magazine", url: "https://www.smithsonianmag.com/science-nature/the-science-behind-honeys-eternal-shelf-life-1218690/" },
  { text: "Los wombats hacen caca en forma de cubos. Un estudio de Georgia Tech vio que se moldean en el último tramo del intestino, por diferencias de elasticidad de sus paredes.", source: "BGR (estudio presentado ante la American Physical Society)", url: "https://bgr.com/science/wombat-poop-cubes-study-research-nature-5660334" },
  { text: "Para la botánica, la banana es una baya y la frutilla no lo es: Britannica clasifica a la frutilla como “fruto accesorio”.", source: "Britannica", url: "https://www.britannica.com/plant/strawberry" },
  { text: "Los tiburones son más antiguos que los árboles: aparecieron hace unos 450 millones de años y los primeros árboles, hace unos 350 millones.", source: "Smithsonian Magazine", url: "https://www.smithsonianmag.com/smart-news/respect-sharks-are-older-than-trees-3818/" },
  { text: "La guerra más corta de la historia fue la anglo-zanzibarí, en 1896: duró alrededor de 40 minutos.", source: "Britannica", url: "https://www.britannica.com/event/Anglo-Zanzibar-War" },
  { text: "El Aconcagua, en Mendoza, mide 6.959 metros: es la montaña más alta del mundo fuera de Asia.", source: "Britannica", url: "https://www.britannica.com/place/Mount-Aconcagua" },
  { text: "El animal nacional de Escocia es el unicornio.", source: "Scotland.org", url: "https://www.scotland.org/inspiration/what-is-the-national-animal-of-scotland" },
  { text: "Los cuervos reconocen caras humanas: en un estudio, regañaron a investigadores con máscara hasta dos años después de que los capturaron.", source: "Universidad de Washington", url: "https://www.washington.edu/news/2012/09/10/crows-react-to-threats-in-human-like-way/" },
  { text: "El desierto más grande del mundo, por falta de lluvias, es la Antártida: en su interior caen menos de 5 cm de precipitación por año.", source: "Britannica", url: "https://www.britannica.com/topic/worlds-largest-deserts-2225895" },
  { text: "Un bebé nace con unos 300 huesos. Muchos se van fusionando y de adulto quedan unos 206.", source: "NIH / NIAMS", url: "https://www.niams.nih.gov/health-topics/educational-resources/health-lesson-learning-about-bones" },
  { text: "Los flamencos son rosados por lo que comen: las algas y los camarones de salmuera aportan pigmentos (carotenoides) que se depositan en sus plumas.", source: "Smithsonian’s National Zoo", url: "https://nationalzoo.si.edu/animals/news/why-are-flamingos-pink-and-other-flamingo-facts" },
  { text: "En el planeta se producen unos 40 a 50 relámpagos por segundo (contando los que no llegan al suelo): cerca de 1.400 millones por año.", source: "NASA Earthdata", url: "https://www.earthdata.nasa.gov/topics/atmosphere/lightning" },
];
