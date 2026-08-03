// FantasyPros 2026 PPR consensus cheat sheet (Latest ECR, "Overview" view),
// captured 2026-08-03 from https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php
// The page renders client-side so it can't be scraped — this is the full pasted
// board, all 517 ranked players (every position, incl. K and DST).
//
// Kept as a delimited string rather than 517 object literals: it is the shape the
// source table comes in, so refreshing it is a paste-and-reformat rather than a
// hand-edit of TypeScript.
//
// Columns: rank|name|pos|proTeam|bye   ("FA|-" = free agent, no bye)

const ECR_ROWS = `
1|Ja'Marr Chase|WR|CIN|6
2|Puka Nacua|WR|LAR|11
3|Bijan Robinson|RB|ATL|11
4|Jahmyr Gibbs|RB|DET|6
5|Jaxon Smith-Njigba|WR|SEA|11
6|Amon-Ra St. Brown|WR|DET|6
7|CeeDee Lamb|WR|DAL|14
8|Christian McCaffrey|RB|SF|8
9|Justin Jefferson|WR|MIN|6
10|Jonathan Taylor|RB|IND|13
11|Drake London|WR|ATL|11
12|A.J. Brown|WR|NE|11
13|Nico Collins|WR|HOU|8
14|Ashton Jeanty|RB|LV|13
15|Chase Brown|RB|CIN|6
16|Trey McBride|TE|ARI|14
17|James Cook III|RB|BUF|7
18|George Pickens|WR|DAL|14
19|Rashee Rice|WR|KC|5
20|Brock Bowers|TE|LV|13
21|De'Von Achane|RB|MIA|6
22|Chris Olave|WR|NO|8
23|DeVonta Smith|WR|PHI|10
24|Omarion Hampton|RB|LAC|7
25|Saquon Barkley|RB|PHI|10
26|Josh Allen|QB|BUF|7
27|Garrett Wilson|WR|NYJ|13
28|Zay Flowers|WR|BAL|13
29|Kenneth Walker III|RB|KC|5
30|Lamar Jackson|QB|BAL|13
31|Tetairoa McMillan|WR|CAR|5
32|Tee Higgins|WR|CIN|6
33|Malik Nabers|WR|NYG|8
34|Ladd McConkey|WR|LAC|7
35|Colston Loveland|TE|CHI|10
36|Emeka Egbuka|WR|TB|10
37|Drake Maye|QB|NE|11
38|Jaylen Waddle|WR|DEN|10
39|Jeremiyah Love|RB|ARI|14
40|Derrick Henry|RB|BAL|13
41|Breece Hall|RB|NYJ|13
42|Kyren Williams|RB|LAR|11
43|Terry McLaurin|WR|WAS|7
44|Josh Jacobs|RB|GB|11
45|Joe Burrow|QB|CIN|6
46|Javonte Williams|RB|DAL|14
47|Luther Burden III|WR|CHI|10
48|Davante Adams|WR|LAR|11
49|Travis Etienne Jr.|RB|NO|8
50|Mike Evans|WR|SF|8
51|Jayden Daniels|QB|WAS|7
52|Cam Skattebo|RB|NYG|8
53|Tyler Warren|TE|IND|13
54|DJ Moore|WR|BUF|7
55|Jameson Williams|WR|DET|6
56|Christian Watson|WR|GB|11
57|Rome Odunze|WR|CHI|10
58|Jalen Hurts|QB|PHI|10
59|Bucky Irving|RB|TB|10
60|Quinshon Judkins|RB|CLE|11
61|D'Andre Swift|RB|CHI|10
62|David Montgomery|RB|HOU|8
63|TreVeyon Henderson|RB|NE|11
64|Carnell Tate|WR|TEN|9
65|Caleb Williams|QB|CHI|10
66|Justin Herbert|QB|LAC|7
67|Marvin Harrison Jr.|WR|ARI|14
68|Bhayshul Tuten|RB|JAC|7
69|Harold Fannin Jr.|TE|CLE|11
70|Tucker Kraft|TE|GB|11
71|Jaylen Warren|RB|PIT|9
72|Trevor Lawrence|QB|JAC|7
73|Jadarian Price|RB|SEA|11
74|Brian Thomas Jr.|WR|JAC|7
75|DK Metcalf|WR|PIT|9
76|Dak Prescott|QB|DAL|14
77|Chris Godwin Jr.|WR|TB|10
78|Parker Washington|WR|JAC|7
79|Kyle Pitts Sr.|TE|ATL|11
80|Courtland Sutton|WR|DEN|10
81|Alec Pierce|WR|IND|13
82|Michael Pittman Jr.|WR|PIT|9
83|Rhamondre Stevenson|RB|NE|11
84|Tony Pollard|RB|TEN|9
85|Sam LaPorta|TE|DET|6
86|Chuba Hubbard|RB|CAR|5
87|Rico Dowdle|RB|PIT|9
88|Jordyn Tyson|WR|NO|8
89|Michael Wilson|WR|ARI|14
90|Wan'Dale Robinson|WR|TEN|9
91|Josh Downs|WR|IND|13
92|Jaxson Dart|QB|NYG|8
93|Brock Purdy|QB|SF|8
94|RJ Harvey|RB|DEN|10
95|Jakobi Meyers|WR|JAC|7
96|Travis Kelce|TE|KC|5
97|Quentin Johnston|WR|LAC|7
98|Kenny Gainwell|RB|TB|10
99|Makai Lemon|WR|PHI|10
100|Patrick Mahomes II|QB|KC|5
101|Bo Nix|QB|DEN|10
102|J.K. Dobbins|RB|DEN|10
103|Kyle Monangai|RB|CHI|10
104|Matthew Stafford|QB|LAR|11
105|Jordan Addison|WR|MIN|6
106|George Kittle|TE|SF|8
107|Rachaad White|RB|WAS|7
108|Jared Goff|QB|DET|6
109|Blake Corum|RB|LAR|11
110|Jake Ferguson|TE|DAL|14
111|Aaron Jones Sr.|RB|MIN|6
112|Jayden Reed|WR|GB|11
113|Kyler Murray|QB|MIN|6
114|Dalton Kincaid|TE|BUF|7
115|Baker Mayfield|QB|TB|10
116|Jordan Love|QB|GB|11
117|Dallas Goedert|TE|PHI|10
118|Jonathon Brooks|RB|CAR|5
119|Tyler Shough|QB|NO|8
120|Khalil Shakir|WR|BUF|7
121|Jayden Higgins|WR|HOU|8
122|Xavier Worthy|WR|KC|5
123|Isaiah Likely|TE|NYG|8
124|Jacory Croskey-Merritt|RB|WAS|7
125|Jordan Mason|RB|MIN|6
126|Mark Andrews|TE|BAL|13
127|Jalen Coker|WR|CAR|5
128|Romeo Doubs|WR|NE|11
129|KC Concepcion|WR|CLE|11
130|Malik Willis|QB|MIA|6
131|Tyrone Tracy Jr.|RB|NYG|8
132|Matthew Golden|WR|GB|11
133|Woody Marks|RB|HOU|8
134|C.J. Stroud|QB|HOU|8
135|Tyler Allgeier|RB|ARI|14
136|Sam Darnold|QB|SEA|11
137|Tyjae Spears|RB|TEN|9
138|Chris Rodriguez Jr.|RB|JAC|7
139|Alvin Kamara|RB|NO|8
140|Dylan Sampson|RB|CLE|11
141|Rashid Shaheed|WR|SEA|11
142|Juwan Johnson|TE|NO|8
143|Zach Charbonnet|RB|SEA|11
144|Cam Ward|QB|TEN|9
145|Chig Okonkwo|TE|WAS|7
146|Isiah Pacheco|RB|DET|6
147|Jauan Jennings|WR|MIN|6
148|Brenton Strange|TE|JAC|7
149|Jerry Jeudy|WR|CLE|11
150|Daniel Jones|QB|IND|13
151|Hunter Henry|TE|NE|11
152|Bryce Young|QB|CAR|5
153|Adonai Mitchell|WR|NYJ|13
154|Houston Texans|DEF|HOU|8
155|Omar Cooper Jr.|WR|NYJ|13
156|Denzel Boston|WR|CLE|11
157|Oronde Gadsden II|TE|LAC|7
158|Jonah Coleman|RB|DEN|10
159|Keaton Mitchell|RB|LAC|7
160|Tank Bigsby|RB|PHI|10
161|Brian Robinson Jr.|RB|ATL|11
162|Jalen McMillan|WR|TB|10
163|Tre Tucker|WR|LV|13
164|Deebo Samuel Sr.|WR|SF|8
165|Denver Broncos|DEF|DEN|10
166|Dalton Schultz|TE|HOU|8
167|Travis Hunter|WR|JAC|7
168|Seattle Seahawks|DEF|SEA|11
169|Tre' Harris|WR|LAC|7
170|Los Angeles Rams|DEF|LAR|11
171|Philadelphia Eagles|DEF|PHI|10
172|Braelon Allen|RB|NYJ|13
173|T.J. Hockenson|TE|MIN|6
174|Ryan Flournoy|WR|DAL|14
175|Jacoby Brissett|QB|ARI|14
176|James Conner|RB|ARI|14
177|Stefon Diggs|WR|FA|-
178|Brandon Aubrey|K|DAL|14
179|Pittsburgh Steelers|DEF|PIT|9
180|Kayshon Boutte|WR|NE|11
181|Minnesota Vikings|DEF|MIN|6
182|Jacksonville Jaguars|DEF|JAC|7
183|New England Patriots|DEF|NE|11
184|Troy Franklin|WR|DEN|10
185|Kimani Vidal|RB|LAC|7
186|De'Zhaun Stribling|WR|SF|8
187|Calvin Ridley|WR|TEN|9
188|Los Angeles Chargers|DEF|LAC|7
189|Ray Davis|RB|BUF|7
190|Jaylin Noel|WR|HOU|8
191|AJ Barner|TE|SEA|11
192|Jalen Nailor|WR|LV|13
193|Cameron Dicker|K|LAC|7
194|Ka'imi Fairbairn|K|HOU|8
195|Emmett Johnson|RB|KC|5
196|Cam Little|K|JAC|7
197|Dontayvion Wicks|WR|PHI|10
198|Darnell Mooney|WR|NYG|8
199|Jason Myers|K|SEA|11
200|Baltimore Ravens|DEF|BAL|13
201|Sean Tucker|RB|TB|10
202|Malik Washington|WR|MIA|6
203|Kenyon Sadiq|TE|NYJ|13
204|Isaac TeSlaa|WR|DET|6
205|Gunnar Helm|TE|TEN|9
206|Emanuel Wilson|RB|SEA|11
207|Green Bay Packers|DEF|GB|11
208|Eddy Pineiro|K|SF|8
209|Antonio Williams|WR|WAS|7
210|Pat Bryant|WR|DEN|10
211|Tyler Loop|K|BAL|13
212|Kansas City Chiefs|DEF|KC|5
213|Nicholas Singleton|RB|TEN|9
214|Rashod Bateman|WR|BAL|13
215|Evan McPherson|K|CIN|6
216|Cairo Santos|K|CHI|10
217|Geno Smith|QB|NYJ|13
218|Detroit Lions|DEF|DET|6
219|Cooper Kupp|WR|SEA|11
220|Mike Washington Jr.|RB|LV|13
221|Aaron Rodgers|QB|PIT|9
222|Jake Bates|K|DET|6
223|Andy Borregales|K|NE|11
224|Tank Dell|WR|HOU|8
225|Buffalo Bills|DEF|BUF|7
226|Cleveland Browns|DEF|CLE|11
227|Kaytron Allen|RB|WAS|7
228|Chase McLaughlin|K|TB|10
229|MarShawn Lloyd|RB|GB|11
230|Pat Freiermuth|TE|PIT|9
231|Chimere Dike|WR|TEN|9
232|Harrison Mevis|K|LAR|11
233|Cade Otton|TE|TB|10
234|Zachariah Branch|WR|ATL|11
235|Jaylen Wright|RB|MIA|6
236|Germie Bernard|WR|PIT|9
237|Terrance Ferguson|TE|LAR|11
238|Harrison Butker|K|KC|5
239|Ted Hurst III|WR|TB|10
240|Jaydon Blue|RB|DAL|14
241|Jack Bech|WR|LV|13
242|Ollie Gordon II|RB|MIA|6
243|Chris Boswell|K|PIT|9
244|Keon Coleman|WR|BUF|7
245|David Njoku|TE|LAC|7
246|Evan Engram|TE|DEN|10
247|Justice Hill|RB|BAL|13
248|Elic Ayomanor|WR|TEN|9
249|Colby Parkinson|TE|LAR|11
250|Brandon Aiyuk|WR|SF|8
251|Fernando Mendoza|QB|LV|13
252|Greg Dulcich|TE|MIA|6
253|Tua Tagovailoa|QB|ATL|11
254|Isaiah Davis|RB|NYJ|13
255|George Holani|RB|SEA|11
256|Tory Horton|WR|SEA|11
257|Chris Bell|WR|MIA|6
258|Wil Lutz|K|DEN|10
259|Demond Claiborne|RB|MIN|6
260|Malachi Fields|WR|NYG|8
261|Elijah Sarratt|WR|BAL|13
262|Ty Johnson|RB|BUF|7
263|Eli Stowers|TE|PHI|10
264|Christian Kirk|WR|SF|8
265|DJ Giddens|RB|IND|13
266|Tyquan Thornton|WR|KC|5
267|Jordan James|RB|SF|8
268|Darius Slayton|WR|NYG|8
269|Atlanta Falcons|DEF|ATL|11
270|Mason Taylor|TE|NYJ|13
271|Chris Brooks|RB|GB|11
272|Theo Johnson|TE|NYG|8
273|Trey Benson|RB|ARI|14
274|LeQuint Allen Jr.|RB|JAC|7
275|San Francisco 49ers|DEF|SF|8
276|Xavier Legette|WR|CAR|5
277|Marvin Mims Jr.|WR|DEN|10
278|Samaje Perine|RB|CIN|6
279|Devin Neal|RB|NO|8
280|Will Reichard|K|MIN|6
281|Devaughn Vele|WR|NO|8
282|Michael Penix Jr.|QB|ATL|11
283|Malik Davis|RB|DAL|14
284|Deshaun Watson|QB|CLE|11
285|Oscar Delp|TE|NO|8
286|Kaelon Black|RB|SF|8
287|Kendre Miller|RB|NO|8
288|Tyreek Hill|WR|FA|-
289|Kirk Cousins|QB|LV|13
290|Kaleb Johnson|RB|PIT|9
291|Hollywood Brown|WR|PHI|10
292|Emari Demercado|RB|KC|5
293|Keenan Allen|WR|LAC|7
294|Shedeur Sanders|QB|CLE|11
295|Mack Hollins|WR|NE|11
296|Brashard Smith|RB|KC|5
297|Devin Singletary|RB|NYG|8
298|Kyle Williams|WR|NE|11
299|Mike Gesicki|TE|CIN|6
300|Jerome Ford|RB|WAS|7
301|New Orleans Saints|DEF|NO|8
302|Adam Randall|RB|BAL|13
303|Skyler Bell|WR|BUF|7
304|Najee Harris|RB|LAC|7
305|Charlie Smyth|K|NO|8
306|Tahj Brooks|RB|CIN|6
307|Isaiah Bond|WR|CLE|11
308|Seth McGowan|RB|IND|13
309|Trevor Etienne|RB|CAR|5
310|Jaleel McLaughlin|RB|DEN|10
311|Isaac Guerendo|RB|SF|8
312|Ja'Kobi Lane|WR|BAL|13
313|Chris Brazzell II|WR|CAR|5
314|Indianapolis Colts|DEF|IND|13
315|Jake Tonges|TE|SF|8
316|Jarquez Hunter|RB|LAR|11
317|Chicago Bears|DEF|CHI|10
318|Andrei Iosivas|WR|CIN|6
319|Audric Estime|RB|NO|8
320|Darnell Washington|TE|PIT|9
321|Will Shipley|RB|PHI|10
322|Joe Mixon|RB|FA|-
323|Kareem Hunt|RB|FA|-
324|J.J. McCarthy|QB|MIN|6
325|Cedric Tillman|WR|CLE|11
326|Konata Mumpfield|WR|LAR|11
327|Jalen Royals|WR|KC|5
328|Luke McCaffrey|WR|WAS|7
329|Caleb Douglas|WR|MIA|6
330|Jalen Tolbert|WR|MIA|6
331|Tez Johnson|WR|TB|10
332|Carolina Panthers|DEF|CAR|5
333|Elijah Arroyo|TE|SEA|11
334|Tyler Higbee|TE|LAR|11
335|Jahan Dotson|WR|ATL|11
336|Max Klare|TE|LAR|11
337|Olamide Zaccheaus|WR|ATL|11
338|Calvin Austin III|WR|NYG|8
339|Bam Knight|RB|ARI|14
340|Noah Gray|TE|KC|5
341|Michael Mayer|TE|LV|13
342|Ja'Tavion Sanders|TE|CAR|5
343|Joshua Palmer|WR|BUF|7
344|Cole Kmet|TE|CHI|10
345|Jake Elliott|K|PHI|10
346|DeMario Douglas|WR|NE|11
347|Mac Jones|QB|SF|8
348|Treylon Burks|WR|WAS|7
349|Kendrick Bourne|WR|ARI|14
350|Eli Heidenreich|RB|PIT|9
351|Dawson Knox|TE|BUF|7
352|Michael Carter|RB|TEN|9
353|Dallas Cowboys|DEF|DAL|14
354|Jawhar Jordan|RB|HOU|8
355|Justin Fields|QB|KC|5
356|New York Giants|DEF|NYG|8
357|Dont'e Thornton Jr.|WR|LV|13
358|Carson Beck|QB|ARI|14
359|Nick Chubb|RB|FA|-
360|Raheim Sanders|RB|CLE|11
361|Cyrus Allen|WR|KC|5
362|Erick All Jr.|TE|CIN|6
363|Anthony Richardson Sr.|QB|IND|13
364|J'Mari Taylor|RB|JAC|7
365|Tyler Bass|K|BUF|7
366|Justin Joly|TE|DEN|10
367|Zane Gonzalez|K|MIA|6
368|Xavier Hutchinson|WR|HOU|8
369|John Metchie III|WR|CAR|5
370|Bryce Lance|WR|NO|8
371|Ty Simpson|QB|LAR|11
372|Tampa Bay Buccaneers|DEF|TB|10
373|Noah Fant|TE|NO|8
374|Brenen Thompson|WR|LAC|7
375|Eli Raridon|TE|NE|11
376|Tutu Atwell|WR|MIA|6
377|Nick Folk|K|ATL|11
378|Tennessee Titans|DEF|TEN|9
379|Jaylin Lane|WR|WAS|7
380|Luke Musgrave|TE|GB|11
381|Kalif Raymond|WR|CHI|10
382|Phil Mafah|RB|DAL|14
383|Kevin Coleman Jr.|WR|MIA|6
384|Austin Ekeler|RB|FA|-
385|Miami Dolphins|DEF|MIA|6
386|John Bates|TE|WAS|7
387|Trey Smack|K|GB|11
388|Blake Grupe|K|IND|13
389|Washington Commanders|DEF|WAS|7
390|Kyle Juszczyk|RB|SF|8
391|Nick Westbrook-Ikhine|WR|IND|13
392|Cincinnati Bengals|DEF|CIN|6
393|Savion Williams|WR|GB|11
394|Ben Sinnott|TE|WAS|7
395|Ryan Fitzgerald|K|CAR|5
396|KaVontae Turpin|WR|DAL|14
397|Tommy Tremble|TE|CAR|5
398|Dameon Pierce|RB|PHI|10
399|Jordan Whittington|WR|LAR|11
400|Ben Sauls|K|NYG|8
401|Chad Ryland|K|ARI|14
402|Devontez Walker|WR|BAL|13
403|Antonio Gibson|RB|FA|-
404|Spencer Shrader|K|IND|13
405|Joe Flacco|QB|CIN|6
406|Darren Waller|TE|FA|-
407|Jam Miller|RB|NE|11
408|Deion Burks|WR|IND|13
409|Marcus Mariota|QB|WAS|7
410|Joe Milton III|QB|DAL|14
411|Daniel Carlson|K|LV|13
412|Dyami Brown|WR|WAS|7
413|Joey Slye|K|TEN|9
414|Brandon McManus|K|FA|-
415|Jameis Winston|QB|NYG|8
416|Austin Hooper|TE|ATL|11
417|Terrell Jennings|RB|NE|11
418|Sione Vaki|RB|DET|6
419|Roschon Johnson|RB|CHI|10
420|Mitchell Evans|TE|CAR|5
421|Ashton Dulin|WR|IND|13
422|Zavion Thomas|WR|CHI|10
423|Zach Ertz|TE|FA|-
424|Rasheen Ali|RB|BAL|13
425|Miles Sanders|RB|FA|-
426|Jeremy McNichols|RB|WAS|7
427|Tyler Lockett|WR|LV|13
428|Jonnu Smith|TE|FA|-
429|Colbie Young|WR|CIN|6
430|Daniel Bellinger|TE|TEN|9
431|Jaydn Ott|RB|KC|5
432|Jake Moody|K|WAS|7
433|Mitch Tinsley|WR|CIN|6
434|Elijah Higgins|TE|ARI|14
435|Elijah Mitchell|RB|PHI|10
436|Jahdae Walker|WR|CHI|10
437|Jaret Patterson|RB|LAC|7
438|Ty Chandler|RB|NO|8
439|Zavier Scott|RB|MIN|6
440|Hunter Luepke|RB|DAL|14
441|Cash Jones|RB|ATL|11
442|Greg Dortch|WR|DET|6
443|Xavier Restrepo|WR|TEN|9
444|Charlie Kolar|TE|LAC|7
445|Dylan Laube|RB|LV|13
446|Tommy Myers|TE|FA|-
447|Marlin Klein|TE|HOU|8
448|Mo Alie-Cox|TE|IND|13
449|Tyler Goodson|RB|ATL|11
450|CJ Daniels|WR|LAR|11
451|Drew Sample|TE|CIN|6
452|Malik Benson|WR|LV|13
453|Josh Oliver|TE|MIN|6
454|DeAndre Hopkins|WR|BAL|13
455|Theo Wease Jr.|WR|MIA|6
456|Kevin Austin Jr.|WR|NO|8
457|Jakobie Keeney-James|WR|FA|-
458|Derius Davis|WR|LAC|7
459|Jacob Saylors|RB|DET|6
460|Ronnie Rivers|RB|LAR|11
461|Jake Bobo|WR|SEA|11
462|Scotty Miller|WR|CHI|10
463|Alexander Mattison|RB|FA|-
464|Cade Klubnik|QB|NYJ|13
465|New York Jets|DEF|NYJ|13
466|Las Vegas Raiders|DEF|LV|13
467|Elijah Tau-Tolliver|RB|BAL|13
468|Taysom Hill|TE|FA|-
469|Damien Martinez|RB|GB|11
470|Michael Trigg|TE|DAL|14
471|Myles Montgomery|RB|NE|11
472|Donovan Edwards|RB|MIA|6
473|Roman Hemby|RB|LV|13
474|Frank Gore Jr.|RB|BUF|7
475|Adam Trautman|TE|DEN|10
476|Khalil Herbert|RB|SF|8
477|Jordan Waters|RB|LAR|11
478|Xavier Smith|WR|LAR|11
479|Odell Beckham Jr.|WR|NYG|8
480|Luke Schoonmaker|TE|DAL|14
481|Michael Woods II|WR|DEN|10
482|Kendric Pryor|WR|CIN|6
483|Robert Henry Jr.|RB|WAS|7
484|Will Dissly|TE|FA|-
485|Raheem Mostert|RB|LV|13
486|Jake Browning|QB|TB|10
487|Sam Roush|TE|CHI|10
488|Demarcus Robinson|WR|SF|8
489|Reggie Gilliam|RB|NE|11
490|Elijah Moore|WR|PHI|10
491|Gardner Minshew II|QB|ARI|14
492|Riley Leonard|QB|IND|13
493|Cade Stover|TE|HOU|8
494|Jeshaun Jones|WR|MIN|6
495|Reggie Virgil|WR|ARI|14
496|David Sills V|WR|TB|10
497|Marquez Valdes-Scantling|WR|DAL|14
498|Tanner Hudson|TE|CIN|6
499|Van Jefferson|WR|WAS|7
500|Jacardia Wright|RB|SEA|11
501|Cam Akers|RB|FA|-
502|Thomas Fidone II|TE|NYG|8
503|Durham Smythe|TE|BAL|13
504|Roman Wilson|WR|PIT|9
505|Jordan Watkins|WR|SF|8
506|Nate Boerkircher|TE|JAC|7
507|Jared Wiley|TE|KC|5
508|Brock Wright|TE|DET|6
509|Jason Sanders|K|NYJ|13
510|Quinn Ewers|QB|MIA|6
511|Jimmy Horn Jr.|WR|CAR|5
512|Tyler Conklin|TE|DET|6
513|Jermaine Burton|WR|FA|-
514|Moliki Matavao|TE|NO|8
515|Skyy Moore|WR|GB|11
516|Tai Felton|WR|MIN|6
517|Jacob Cowing|WR|SF|8
`;

export interface EcrPlayer {
  /** FantasyPros overall consensus rank — 1 is the best player on the board. */
  rank: number;
  name: string;
  /** QB | RB | WR | TE | K | DEF (their DST rows are normalised to DEF here). */
  pos: string;
  /** NFL team abbreviation, or "FA" for free agents. */
  proTeam: string;
  /** Undefined for free agents, who have no bye until they sign. */
  bye?: number;
}

export const FANTASYPROS_ECR_2026: EcrPlayer[] = ECR_ROWS.trim()
  .split("\n")
  .map((line) => {
    const [rank, name, pos, proTeam, bye] = line.split("|");
    return {
      rank: Number(rank),
      name,
      pos,
      proTeam,
      bye: bye === "-" ? undefined : Number(bye),
    };
  });
