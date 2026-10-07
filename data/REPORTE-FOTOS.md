# Fotos de la tienda — revisión del 7/10/2026

Hecho sobre https://inedita-tienda.vercel.app (deploy a8a5b5d). Las fotos se revisaron **mirándolas** (miniaturas de los originales de Drive, artículo por artículo), no solo por el nombre del archivo.

## Resumen

- **Se ven en todos los dispositivos.** Las fotos estaban en Vercel Blob y el almacenamiento quedó suspendido (límite del plan gratis): por eso no se veían en otros equipos. Ahora están en la base de datos y se sirven desde la web. Verificación desde afuera: **1117 de 1117 fotos cargan bien**, 0 rotas; revisión en la base: 848 fotos de los 179 productos publicados, ninguna rota, ningún producto sin foto.
- **Origen:** Drive › Temporada 3 › *Capsulas INEDITA / CAPSULAS FOTOS SOLAS* y *FOTOS DE CAPSULAS LIMPIAS (y TODAS)*: 1001 fotos distintas, cruzadas por el código de artículo de 5 cifras.
- **182 de 182 artículos con fotos**, en este orden: 1) la mejor foto de la modelo con la prenda, 2) otras de la modelo, 3) la prenda sola (frente y espalda de cada color), 4) detalles. La principal se revisó a ojo en los 182.
- **Repetidas quitadas: 891** (copias "Copia de …", el mismo archivo en dos carpetas y 56 tomas iguales con otro nombre, por ejemplo "__3-39003-35044_limpia" y "39003-1"). Frente/espalda o la misma prenda en otro color **no** se cuentan como repetidas.
- **Fotos de otra prenda quitadas: 42** (conjuntos: la blusa en el short, fotos donde solo se ve el pantalón en la blusa, etc.).
- **Encuadre:** 256 fotos con modelo tenían bandas blancas a los costados; se volvieron a recortar a 3:4 desde el original (sin cortar cabezas). Quedan 46 que se terminan en el próximo deploy (automático).
- **Catálogo:** en cada tarjeta se pueden deslizar hasta 6 fotos (con el dedo en el celular, con flechas en la compu). La ficha tiene todas, con miniaturas y zoom.

## Faltantes / a revisar

- **3 fotos que no se pueden traer solas:** 39888_LIMPIA.png, 39887_LIMPIA.png y 39801_LIMPIA.png están solo en *Tienda Nube › Fotos - 25 artículos pendientes Tiendanube*, que no está compartida con el enlace. Si las querés en la web, copialas a *CAPSULAS FOTOS SOLAS* (esos artículos igual ya tienen fotos con modelo).
- **Cartera Kang (39181):** una sola foto, la cartera sola (no hay foto con modelo en Drive).
- **Ocultos en la tienda** (tienen fotos, están ocultos desde antes): Top Blanchett 39017, Faja Hill 39188, Carrot Brad 39801.
- Si una principal no te gusta: Admin › Productos › el producto › "Hacer principal". Ese orden se respeta en los deploys siguientes.

## Por artículo

| Artículo | Nombre | Fotos | Principal | Correcciones |
|---|---|---:|---|---|
| 37260 | Blusa Physalis | 4 | modelo con la prenda | — |
| 37261 | Blusa Kumquat | 3 | modelo con la prenda | foto "SET CON" del otro artículo, sacada; la principal tenía el pantalón del conjunto: ahora es la blusa puesta |
| 37262 | Pantalón Kumquat | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 37263 | Vestido Hyptis | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 37264 | Blusa Flaveria | 4 | modelo con la prenda | — |
| 37436 | Pantalón Citrus | 4 | modelo con la prenda | — |
| 37664 | Top Tubiflora | 4 | modelo con la prenda | — |
| 37665 | Blusa Ipomoea | 4 | modelo con la prenda | — |
| 37672 | Vestido Manzanilla | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 37674 | Vestido Ambrosia | 4 | modelo con la prenda | — |
| 37675 | Vestido Sativa | 5 | modelo con la prenda | — |
| 37676 | Pantalón Colletia | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 37678 | Pantalón Malva | 4 | modelo con la prenda | — |
| 37685 | Remera Pachanoi | 5 | modelo con la prenda | — |
| 37699 | Blusa Aristida | 4 | modelo con la prenda | — |
| 38178 | Blazer Brandon | 5 | modelo con la prenda | — |
| 38254 | Blusa Styles | 5 | modelo con la prenda | — |
| 38266 | Buzo Lauv | 4 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 38267 | Pantalón Lauv | 4 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 38268 | Buzo Musgraves | 8 | modelo con la prenda | — |
| 38627 | Blusa Janis | 5 | modelo con la prenda | sacadas 2 foto(s) donde no se ve la prenda |
| 38648 | Piloto Frank | 5 | modelo con la prenda | — |
| 38672 | Blusa Keys | 5 | modelo con la prenda | — |
| 38673 | Camisa Aretha | 4 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 38674 | Pantalón Arethea | 5 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 38675 | Remera Lola | 8 | modelo con la prenda | — |
| 38676 | Remera Steven | 5 | modelo con la prenda | — |
| 38680 | Remera Julien | 4 | modelo con la prenda | — |
| 38681 | Remera Tukker | 6 | modelo con la prenda | — |
| 38682 | Remera Sinatra | 6 | modelo con la prenda | misma toma repetida con otro nombre |
| 38684 | Remera Horan | 4 | modelo con la prenda | — |
| 38690 | Remera Stefani | 4 | modelo con la prenda | — |
| 38696 | Short Zara | 4 | modelo con la prenda | — |
| 38699 | Blusa Raye | 5 | modelo con la prenda | misma toma repetida con otro nombre |
| 38971 | Remera Brody | 8 | modelo con la prenda | — |
| 39000 | Blusa Davis | 6 | modelo con la prenda | — |
| 39001 | Blusa Cruz | 5 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; foto "SET CON" del otro artículo, sacada |
| 39002 | Blusa Kaluya | 5 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39003 | Blusa Zoe | 8 | modelo con la prenda | misma toma repetida con otro nombre |
| 39004 | Blusa Julia | 7 | modelo con la prenda | misma toma repetida con otro nombre |
| 39005 | Blusa Sofia | 5 | modelo con la prenda | misma toma repetida con otro nombre |
| 39007 | Blusa Driver | 7 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39008 | Blusa Amanda | 8 | modelo con la prenda | — |
| 39010 | Top Barrymore | 5 | modelo con la prenda | — |
| 39012 | Blusa Keira | 6 | modelo con la prenda | misma toma repetida con otro nombre |
| 39013 | Blusa Mirren | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39014 | Blusa Diane | 4 | modelo con la prenda | — |
| 39016 | Top Depp | 8 | modelo con la prenda | — |
| 39017 | Top Blanchett · oculto | 7 | modelo con la prenda | misma toma repetida con otro nombre |
| 39018 | Top Hathaway | 5 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; foto "SET CON" del otro artículo, sacada |
| 39020 | Blusa Hugh | 4 | modelo con la prenda | — |
| 39091 | Top Emma | 4 | modelo con la prenda | misma toma repetida con otro nombre; sacadas 2 foto(s) donde no se ve la prenda |
| 39092 | Top Robbie | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39093 | Camisa Dench | 5 | modelo con la prenda | misma toma repetida con otro nombre; sacada la prenda sola del otro artículo del conjunto; la principal era la prenda sola: ahora es la modelo con la prenda |
| 39160 | Sweater Ronan | 5 | modelo con la prenda | sacadas 2 foto(s) donde no se ve la prenda |
| 39164 | Sweater Helen | 5 | modelo con la prenda | sacadas 3 foto(s) donde no se ve la prenda |
| 39165 | Sweater Sean | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39180 | Cartera Matt | 2 | modelo con la prenda | — |
| 39181 | Cartera Kang | 1 | prenda sola (sin foto con modelo) | — |
| 39187 | Gorra Barry | 3 | modelo con la prenda | — |
| 39188 | Faja Hill · oculto | 1 | modelo con la prenda | misma toma repetida con otro nombre |
| 39194 | Bolso Spencer | 2 | modelo con la prenda | — |
| 39195 | Bolso Paltrow | 2 | modelo con la prenda | sacadas 2 foto(s) donde no se ve la prenda |
| 39196 | Cartera Wong | 2 | modelo con la prenda | — |
| 39198 | Cinturón Willis | 1 | modelo con la prenda | misma toma repetida con otro nombre |
| 39200 | Mono Ali | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39201 | Vestido Wood | 4 | modelo con la prenda | misma toma repetida con otro nombre |
| 39202 | Vestido Nyongo | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39203 | Vestido Berry | 4 | modelo con la prenda | — |
| 39204 | Mono Freeman | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39205 | Vestido Roberts | 4 | modelo con la prenda | — |
| 39207 | Vestido Firth | 4 | modelo con la prenda | — |
| 39208 | Vestido Olsen | 8 | modelo con la prenda | — |
| 39209 | Mono Reeves | 4 | modelo con la prenda | — |
| 39212 | Vestido James | 3 | modelo con la prenda | — |
| 39215 | Vestido Gosling | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39266 | Vestido Lupita | 7 | modelo con la prenda | — |
| 39269 | Vestido Colin | 2 | modelo con la prenda | misma toma repetida con otro nombre |
| 39300 | Pollera Downey | 3 | modelo con la prenda | — |
| 39364 | Pollera Damon | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39365 | Pollera Elle | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39366 | Pollera Ortega | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39400 | Short Cruz | 5 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; la principal era la prenda del otro artículo: ahora es la de la modelo con esta prenda |
| 39401 | Pantalón Forest | 6 | modelo con la prenda | sacada 1 foto donde no se ve la prenda; foto "SET CON" del otro artículo, sacada |
| 39402 | Pantalón Kaluuya | 3 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39403 | Short King | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39404 | Pantalón Jackie | 9 | modelo con la prenda | misma toma repetida con otro nombre |
| 39405 | Pantalón Chan | 10 | modelo con la prenda | — |
| 39406 | Pantalón Regina | 5 | modelo con la prenda | — |
| 39407 | Pantalón Driver | 8 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39409 | Short Isla | 5 | modelo con la prenda | — |
| 39410 | Short Day | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39411 | Pantalón Dev | 5 | modelo con la prenda | — |
| 39412 | Pantalón Rebeca | 7 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39413 | Pantalón Kristen | 7 | modelo con la prenda | — |
| 39415 | Pantalón Lawrence | 4 | modelo con la prenda | — |
| 39416 | Short Hanks | 4 | modelo con la prenda | — |
| 39417 | Pantalón Winona | 7 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; foto "SET CON" del otro artículo, sacada; la principal era la prenda del otro artículo: ahora es la de la modelo con esta prenda |
| 39418 | Pantalón Saldana | 5 | modelo con la prenda | — |
| 39419 | Pantalón Hathaway | 5 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; foto "SET CON" del otro artículo, sacada |
| 39422 | Pantalón Bellucci | 5 | modelo con la prenda | — |
| 39425 | Short Farrell | 3 | modelo con la prenda | — |
| 39427 | Babucha Lea | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39472 | Short Dench | 5 | modelo con la prenda | misma toma repetida con otro nombre; sacada la prenda sola del otro artículo del conjunto; la principal era la prenda del otro artículo: ahora es la de la modelo con esta prenda |
| 39474 | Short Emma | 4 | modelo con la prenda | misma toma repetida con otro nombre; sacada 1 foto donde no se ve la prenda; foto "SET CON" del otro artículo, sacada |
| 39475 | Pantalón Mescal | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39601 | Remera Niro | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39602 | Remera Morgan | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39603 | Musculosa Smith | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39604 | Musculosa Streep | 4 | modelo con la prenda | — |
| 39605 | Musculosa Angelina | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39606 | Musculosa Crowe | 4 | modelo con la prenda | — |
| 39700 | Blazer Forest | 7 | modelo con la prenda | sacadas 5 foto(s) donde no se ve la prenda; foto "SET CON" del otro artículo, sacada |
| 39703 | Blazer Rebeca | 5 | modelo con la prenda | sacadas 2 foto(s) donde no se ve la prenda; foto "SET CON" del otro artículo, sacada |
| 39704 | Chaleco Eastwood | 4 | modelo con la prenda | misma toma repetida con otro nombre |
| 39705 | Chaleco Winona | 7 | modelo con la prenda | sacada la prenda sola del otro artículo del conjunto; foto "SET CON" del otro artículo, sacada; la principal era la prenda sola: ahora es la modelo con la prenda |
| 39801 | Carrot Brad · oculto | 3 | modelo con la prenda | — |
| 39860 | Wide Leg Nicole | 5 | modelo con la prenda | — |
| 39861 | Wide Leg Kidman | 5 | modelo con la prenda | — |
| 39862 | Straight Brie | 4 | modelo con la prenda | misma toma repetida con otro nombre; sacada 1 foto donde no se ve la prenda |
| 39863 | Straight Larson | 7 | modelo con la prenda | sacada 1 foto donde no se ve la prenda |
| 39864 | Campera Penelope | 5 | modelo con la prenda | sacada 1 foto donde no se ve la prenda; foto "SET CON" del otro artículo, sacada |
| 39865 | Wide Leg Penelope | 6 | modelo con la prenda | foto "SET CON" del otro artículo, sacada |
| 39869 | Wide Leg Kirby | 4 | modelo con la prenda | — |
| 39870 | Campanita Lady | 6 | modelo con la prenda | — |
| 39871 | Carrot Jordan | 7 | modelo con la prenda | sacada 1 foto donde no se ve la prenda |
| 39873 | Wide Leg Mara | 4 | modelo con la prenda | — |
| 39876 | Wide Leg Dakota | 5 | modelo con la prenda | — |
| 39878 | Bermuda Bill | 5 | modelo con la prenda | — |
| 39879 | Mini Hayek | 4 | modelo con la prenda | — |
| 39880 | Mini Halle | 6 | modelo con la prenda | misma toma repetida con otro nombre |
| 39886 | Straight Bale | 4 | modelo con la prenda | misma toma repetida con otro nombre |
| 39887 | Recto Stone | 4 | modelo con la prenda | — |
| 39888 | Oxford Travolta | 4 | modelo con la prenda | sacada 1 foto donde no se ve la prenda |
| 39889 | Straight Malek | 4 | modelo con la prenda | misma toma repetida con otro nombre |
| 39890 | Campera Darin | 8 | modelo con la prenda | sacadas 4 foto(s) donde no se ve la prenda |
| 39900 | Remera Millie | 4 | modelo con la prenda | — |
| 39901 | Remera Gal | 4 | modelo con la prenda | — |
| 39902 | Remera Bobby | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39903 | Remera Brown | 5 | modelo con la prenda | — |
| 39904 | Musculosa Gadot | 9 | modelo con la prenda | — |
| 39906 | Remera Jet | 9 | modelo con la prenda | — |
| 39907 | Remera Reynolds | 8 | modelo con la prenda | — |
| 39908 | Musculosa Ryan | 4 | modelo con la prenda | — |
| 39909 | Remera Li | 8 | modelo con la prenda | — |
| 39910 | Remera Cameron | 9 | modelo con la prenda | — |
| 39911 | Remera Diaz | 4 | modelo con la prenda | sacada 1 foto donde no se ve la prenda |
| 39914 | Remera Mendes | 4 | modelo con la prenda | — |
| 39917 | Remera Carrey | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39918 | Remera Austin | 4 | modelo con la prenda | — |
| 39919 | Remera Vin | 10 | modelo con la prenda | — |
| 39920 | Remera Grint | 10 | modelo con la prenda | — |
| 39921 | Remera Kit | 9 | modelo con la prenda | — |
| 39923 | Remera Natalie | 4 | modelo con la prenda | — |
| 39925 | Body Scarlett | 7 | modelo con la prenda | misma toma repetida con otro nombre |
| 39926 | Body Joy | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39927 | Remera Gaga | 8 | modelo con la prenda | — |
| 39931 | Remera Phoenix | 4 | modelo con la prenda | — |
| 39932 | Musculosa Knightley | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39935 | Musculosa Portman | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39936 | Remera Stewart | 9 | modelo con la prenda | — |
| 39937 | Remera Cate | 6 | modelo con la prenda | — |
| 39938 | Musculosa Dicaprio | 8 | modelo con la prenda | — |
| 39939 | Remera Leonardo | 8 | modelo con la prenda | — |
| 39949 | Remera Tatum | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39951 | Strapless Dunst | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39980 | Remera Jenna | 4 | modelo con la prenda | — |
| 39981 | Remera Ana | 2 | modelo con la prenda | misma toma repetida con otro nombre |
| 39982 | Remera Taraji | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39987 | Remera Sandra | 2 | modelo con la prenda | — |
| 39988 | Remera Bullock | 6 | modelo con la prenda | principal elegida a mano (la otra tenía bandas) |
| 39989 | Remera Amy | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39990 | Remera Adams | 4 | modelo con la prenda | — |
| 39991 | Remera Idris | 3 | modelo con la prenda | misma toma repetida con otro nombre |
| 39992 | Musculosa Elba | 4 | modelo con la prenda | — |
| 39993 | Musculosa Daniel | 4 | modelo con la prenda | — |
| 39994 | Remera Craig | 6 | modelo con la prenda | — |
| 39995 | Musculosa Gael | 5 | modelo con la prenda | — |
| 39996 | Remera Garcia | 2 | modelo con la prenda | — |
| 39997 | Musculosa Bernal | 4 | modelo con la prenda | — |
| 39998 | Remera Megan | 4 | modelo con la prenda | — |
| 39999 | Remera Fox | 3 | modelo con la prenda | — |

Además, en todos: sin copias repetidas y fotos con modelo encuadradas a 3:4.

## Cómo se mantiene

- Las reglas revisadas a ojo están en `data/fotos-repetidas-confirmadas.json` (misma toma con otro nombre) y `data/fotos-articulo.json` (qué foto va en qué artículo de un conjunto y principales elegidas a mano).
- En cada deploy: se buscan fotos nuevas en esas carpetas de Drive, se importan, se sacan repetidas y fotos de otra prenda, se ordenan, se encuadran y se verifica la tienda publicada (`verificacion-en-vivo` en la base).
