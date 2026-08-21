/**
 * Seed content for the quiz game: 50 questions per category, 200 total.
 *
 * Every item is a stable, verifiable fact. Deliberately avoided:
 *  - current officeholders / champions / "largest by population" — these go
 *    stale and would silently start marking correct answers wrong,
 *  - genuinely disputed facts (e.g. Nile vs Amazon as longest river),
 * so the pool stays correct without maintenance.
 *
 * `correctIndex` is 0-based into [optionA, optionB, optionC, optionD].
 */

export type SeedQuizCategory =
  | 'POLITICS'
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'GENERAL_KNOWLEDGE';

export interface SeedQuizQuestion {
  category: SeedQuizCategory;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctIndex: number;
  explanation: string;
}

const POLITICS: Omit<SeedQuizQuestion, 'category'>[] = [
  { question: 'How many members sit on the United Nations Security Council?', optionA: '10', optionB: '15', optionC: '20', optionD: '25', correctIndex: 1, explanation: 'Five permanent members plus ten elected on two-year terms.' },
  { question: 'Which US founding document opens with the words “We the People”?', optionA: 'Declaration of Independence', optionB: 'Bill of Rights', optionC: 'The Constitution', optionD: 'Articles of Confederation', correctIndex: 2, explanation: 'The Preamble to the US Constitution begins “We the People of the United States…”.' },
  { question: 'How long is a single term for a United States Senator?', optionA: '2 years', optionB: '4 years', optionC: '6 years', optionD: '8 years', correctIndex: 2, explanation: 'Senators serve six-year terms, with about a third of the Senate up for election every two years.' },
  { question: 'In which city is the European Parliament officially seated?', optionA: 'Brussels', optionB: 'Strasbourg', optionC: 'Luxembourg', optionD: 'Frankfurt', correctIndex: 1, explanation: 'Strasbourg is the official seat, though committee work also takes place in Brussels.' },
  { question: 'Which 1992 treaty formally established the European Union?', optionA: 'Treaty of Rome', optionB: 'Treaty of Lisbon', optionC: 'Maastricht Treaty', optionD: 'Treaty of Nice', correctIndex: 2, explanation: 'The Maastricht Treaty created the EU and set the path to a single currency.' },
  { question: 'How many amendments does the United States Constitution currently have?', optionA: '21', optionB: '25', optionC: '27', optionD: '31', correctIndex: 2, explanation: 'The 27th, on congressional pay, was ratified in 1992 after being proposed in 1789.' },
  { question: 'What is the minimum age to serve as President of the United States?', optionA: '30', optionB: '35', optionC: '40', optionD: '45', correctIndex: 1, explanation: 'Article II sets a minimum age of 35, along with natural-born citizenship.' },
  { question: 'In the United Kingdom, who formally appoints the Prime Minister?', optionA: 'The monarch', optionB: 'The House of Lords', optionC: 'The Supreme Court', optionD: 'A public vote', correctIndex: 0, explanation: 'The monarch appoints whoever can command a majority in the House of Commons.' },
  { question: 'How many countries hold a permanent veto on the UN Security Council?', optionA: '3', optionB: '5', optionC: '7', optionD: '10', correctIndex: 1, explanation: 'China, France, Russia, the UK and the US each hold a veto.' },
  { question: 'Which of these is NOT a permanent member of the UN Security Council?', optionA: 'France', optionB: 'China', optionC: 'Germany', optionD: 'Russia', correctIndex: 2, explanation: 'Germany is not a permanent member, despite long campaigning for a seat.' },
  { question: 'What does a “bicameral” legislature mean?', optionA: 'It has two chambers', optionB: 'It meets twice a year', optionC: 'It has two leaders', optionD: 'It requires a two-thirds vote', correctIndex: 0, explanation: 'Bicameral means two separate legislative chambers, such as a house and a senate.' },
  { question: 'In which city is the International Court of Justice based?', optionA: 'Geneva', optionB: 'The Hague', optionC: 'Vienna', optionD: 'Paris', correctIndex: 1, explanation: 'The ICJ sits in the Peace Palace in The Hague, Netherlands.' },
  { question: 'In which year was the United Nations founded?', optionA: '1919', optionB: '1939', optionC: '1945', optionD: '1951', correctIndex: 2, explanation: 'The UN Charter came into force in October 1945, after the Second World War.' },
  { question: 'What fraction of US states must ratify a constitutional amendment?', optionA: 'One half', optionB: 'Two thirds', optionC: 'Three quarters', optionD: 'All of them', correctIndex: 2, explanation: 'Three quarters of the states — currently 38 of 50 — must ratify.' },
  { question: 'What is the lower house of the Indian Parliament called?', optionA: 'Rajya Sabha', optionB: 'Lok Sabha', optionC: 'Vidhan Sabha', optionD: 'Panchayat', correctIndex: 1, explanation: 'The Lok Sabha, or House of the People, is directly elected.' },
  { question: 'What is the upper house of the Indian Parliament called?', optionA: 'Lok Sabha', optionB: 'Rajya Sabha', optionC: 'Vidhan Parishad', optionD: 'Senate', correctIndex: 1, explanation: 'The Rajya Sabha, or Council of States, represents the states and territories.' },
  { question: 'In which year did the Constitution of India come into effect?', optionA: '1947', optionB: '1949', optionC: '1950', optionD: '1952', correctIndex: 2, explanation: 'It took effect on 26 January 1950, now marked as Republic Day.' },
  { question: 'Who chaired the drafting committee of the Indian Constitution?', optionA: 'Jawaharlal Nehru', optionB: 'B. R. Ambedkar', optionC: 'Sardar Patel', optionD: 'Rajendra Prasad', correctIndex: 1, explanation: 'B. R. Ambedkar chaired the drafting committee and is widely called its principal architect.' },
  { question: 'How many voting members are in the US House of Representatives?', optionA: '100', optionB: '435', optionC: '500', optionD: '538', correctIndex: 1, explanation: 'The number has been fixed at 435 since 1929, apportioned by population.' },
  { question: 'In legislative terms, what is a “filibuster”?', optionA: 'A surprise vote', optionB: 'A tactic to delay or block a bill', optionC: 'A type of veto', optionD: 'A budget amendment', correctIndex: 1, explanation: 'It extends debate to obstruct or delay a vote on a measure.' },
  { question: 'Which international body regulates global trade rules from Geneva?', optionA: 'IMF', optionB: 'World Bank', optionC: 'WTO', optionD: 'OECD', correctIndex: 2, explanation: 'The World Trade Organization is headquartered in Geneva, Switzerland.' },
  { question: 'What does NATO stand for?', optionA: 'North Atlantic Treaty Organization', optionB: 'National Alliance Trade Organization', optionC: 'Northern Allied Territories Office', optionD: 'North American Treaty Office', correctIndex: 0, explanation: 'NATO is a collective-defence alliance founded on the North Atlantic Treaty.' },
  { question: 'In which year was NATO founded?', optionA: '1945', optionB: '1949', optionC: '1955', optionD: '1961', correctIndex: 1, explanation: 'The North Atlantic Treaty was signed in Washington in April 1949.' },
  { question: 'How many countries were the original founding members of NATO?', optionA: '8', optionB: '12', optionC: '16', optionD: '20', correctIndex: 1, explanation: 'Twelve nations signed the founding treaty in 1949.' },
  { question: 'What is the term for rule by a small privileged elite?', optionA: 'Oligarchy', optionB: 'Theocracy', optionC: 'Monarchy', optionD: 'Autocracy', correctIndex: 0, explanation: 'An oligarchy concentrates power in a small group of people.' },
  { question: 'What is the term for government by the whole eligible population?', optionA: 'Aristocracy', optionB: 'Democracy', optionC: 'Plutocracy', optionD: 'Technocracy', correctIndex: 1, explanation: 'Democracy derives authority from the people, usually through elections.' },
  { question: 'What is a referendum?', optionA: 'A parliamentary debate', optionB: 'A direct public vote on one question', optionC: 'A court ruling', optionD: 'A cabinet reshuffle', correctIndex: 1, explanation: 'A referendum puts a single issue directly to voters rather than to legislators.' },
  { question: 'Which country has the largest electorate of any democracy?', optionA: 'United States', optionB: 'Brazil', optionC: 'Indonesia', optionD: 'India', correctIndex: 3, explanation: 'India has by far the largest number of eligible voters of any democracy.' },
  { question: 'What is an executive’s power to reject proposed legislation called?', optionA: 'Veto', optionB: 'Writ', optionC: 'Injunction', optionD: 'Mandate', correctIndex: 0, explanation: 'A veto blocks a bill, though legislatures can often override it.' },
  { question: 'In which city is the United Nations headquarters located?', optionA: 'Geneva', optionB: 'New York City', optionC: 'Brussels', optionD: 'Vienna', correctIndex: 1, explanation: 'The UN Secretariat sits on the East River in New York City.' },
  { question: 'Which 1215 charter first limited the power of the English monarchy?', optionA: 'Magna Carta', optionB: 'Bill of Rights', optionC: 'Domesday Book', optionD: 'Act of Union', correctIndex: 0, explanation: 'Magna Carta bound the king to law and became a foundation of constitutional rule.' },
  { question: 'What does “universal suffrage” mean?', optionA: 'Compulsory voting', optionB: 'The right to vote for all adult citizens', optionC: 'Voting by post only', optionD: 'One party rule', correctIndex: 1, explanation: 'It means the vote is not restricted by property, sex, race or wealth.' },
  { question: 'What is the US legislative branch called collectively?', optionA: 'Congress', optionB: 'Parliament', optionC: 'The Cabinet', optionD: 'The Assembly', correctIndex: 0, explanation: 'Congress comprises the Senate and the House of Representatives.' },
  { question: 'How many justices sit on the Supreme Court of the United States?', optionA: '7', optionB: '9', optionC: '11', optionD: '12', correctIndex: 1, explanation: 'Nine justices have sat on the Court since 1869.' },
  { question: 'What does impeachment mean?', optionA: 'Removal from office automatically', optionB: 'A formal charge of misconduct against an official', optionC: 'A public censure vote', optionD: 'A forced resignation', correctIndex: 1, explanation: 'Impeachment is the formal accusation; conviction and removal is a separate step.' },
  { question: 'Which EU institution proposes legislation and enforces the treaties?', optionA: 'European Council', optionB: 'European Commission', optionC: 'European Parliament', optionD: 'Court of Auditors', correctIndex: 1, explanation: 'The Commission is the EU executive, with the sole right to propose most laws.' },
  { question: 'What is the Schengen Area?', optionA: 'A customs union', optionB: 'A passport-free travel zone', optionC: 'A single currency bloc', optionD: 'A defence alliance', correctIndex: 1, explanation: 'Schengen abolished systematic internal border checks between member states.' },
  { question: 'In which year did the Berlin Wall fall?', optionA: '1987', optionB: '1989', optionC: '1991', optionD: '1993', correctIndex: 1, explanation: 'The border opened on 9 November 1989, ahead of German reunification in 1990.' },
  { question: 'Which country formally left the European Union in 2020?', optionA: 'Norway', optionB: 'Switzerland', optionC: 'United Kingdom', optionD: 'Denmark', correctIndex: 2, explanation: 'The UK left on 31 January 2020, following the 2016 referendum.' },
  { question: 'What does diplomatic immunity protect a diplomat from?', optionA: 'Taxes only', optionB: 'Prosecution in the host country', optionC: 'Recall by their government', optionD: 'Travel restrictions', correctIndex: 1, explanation: 'Under the Vienna Convention, diplomats are largely immune from host-state jurisdiction.' },
  { question: 'What is gerrymandering?', optionA: 'Manipulating electoral boundaries for advantage', optionB: 'Buying votes', optionC: 'Delaying an election', optionD: 'Miscounting ballots', correctIndex: 0, explanation: 'District lines are redrawn so one party wins more seats for the same vote share.' },
  { question: 'Which chamber of the US Congress ratifies treaties?', optionA: 'The House', optionB: 'The Senate', optionC: 'Both equally', optionD: 'Neither', correctIndex: 1, explanation: 'The Senate must consent to treaties by a two-thirds vote.' },
  { question: 'What is China’s highest state legislative body called?', optionA: 'Politburo', optionB: 'State Council', optionC: 'National People’s Congress', optionD: 'Central Committee', correctIndex: 2, explanation: 'The National People’s Congress is constitutionally the highest organ of state power.' },
  { question: 'What is the official residence of the French President?', optionA: 'Élysée Palace', optionB: 'Palace of Versailles', optionC: 'Hôtel Matignon', optionD: 'The Louvre', correctIndex: 0, explanation: 'The Élysée Palace in Paris has been the presidential residence since 1848.' },
  { question: 'Which committee awards the Nobel Peace Prize?', optionA: 'The Swedish Academy', optionB: 'The Norwegian Nobel Committee', optionC: 'The UN General Assembly', optionD: 'The Karolinska Institute', correctIndex: 1, explanation: 'Alfred Nobel’s will assigned the Peace Prize to a Norwegian committee.' },
  { question: 'What was apartheid?', optionA: 'A trade embargo', optionB: 'A system of enforced racial segregation', optionC: 'A colonial tax', optionD: 'A one-party constitution', correctIndex: 1, explanation: 'Apartheid was South Africa’s legalised system of racial segregation until the early 1990s.' },
  { question: 'Who became President of South Africa after its first fully representative election?', optionA: 'Thabo Mbeki', optionB: 'Desmond Tutu', optionC: 'Nelson Mandela', optionD: 'F. W. de Klerk', correctIndex: 2, explanation: 'Nelson Mandela took office in 1994 after the first election open to all races.' },
  { question: 'What is the title of the head of government in Germany?', optionA: 'President', optionB: 'Chancellor', optionC: 'Prime Minister', optionD: 'First Minister', correctIndex: 1, explanation: 'The Chancellor leads the government; the President is a largely ceremonial head of state.' },
  { question: 'What is a coalition government?', optionA: 'A government of unelected experts', optionB: 'A government formed by two or more parties', optionC: 'A temporary military government', optionD: 'A government without a legislature', correctIndex: 1, explanation: 'Parties combine to command a majority when no single party has one.' },
  { question: 'What does the principle of “separation of powers” divide?', optionA: 'Federal and local taxes', optionB: 'Executive, legislative and judicial authority', optionC: 'Civil and military budgets', optionD: 'Church and state property', correctIndex: 1, explanation: 'Splitting these three functions stops any one branch holding unchecked power.' },
];

const SPORTS: Omit<SeedQuizQuestion, 'category'>[] = [
  { question: 'How many players from one team are on the pitch in football (soccer)?', optionA: '9', optionB: '10', optionC: '11', optionD: '12', correctIndex: 2, explanation: 'Eleven per side, including the goalkeeper.' },
  { question: 'How often is the FIFA World Cup held?', optionA: 'Every 2 years', optionB: 'Every 3 years', optionC: 'Every 4 years', optionD: 'Every 5 years', correctIndex: 2, explanation: 'The men’s World Cup has run on a four-year cycle since 1930, apart from wartime gaps.' },
  { question: 'Which nation has won the most FIFA World Cup titles?', optionA: 'Germany', optionB: 'Italy', optionC: 'Brazil', optionD: 'Argentina', correctIndex: 2, explanation: 'Brazil has five titles, more than any other nation.' },
  { question: 'How many points is a touchdown worth in American football?', optionA: '3', optionB: '6', optionC: '7', optionD: '8', correctIndex: 1, explanation: 'A touchdown is six points, before any conversion attempt.' },
  { question: 'In tennis, what is a score of 40–40 called?', optionA: 'Advantage', optionB: 'Deuce', optionC: 'Let', optionD: 'Break point', correctIndex: 1, explanation: 'At deuce a player must win two consecutive points to take the game.' },
  { question: 'How many players from one team are on court in basketball?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 0, explanation: 'Five per side, with unlimited substitutions.' },
  { question: 'What is the internal diameter of a basketball hoop?', optionA: '16 inches', optionB: '18 inches', optionC: '20 inches', optionD: '24 inches', correctIndex: 1, explanation: 'The rim is 18 inches across, roughly twice the width of the ball.' },
  { question: 'How many holes are played in a standard round of golf?', optionA: '9', optionB: '12', optionC: '18', optionD: '21', correctIndex: 2, explanation: 'A full round is 18 holes; nine-hole rounds are a half round.' },
  { question: 'How many legal balls are bowled in a single over in cricket?', optionA: '4', optionB: '5', optionC: '6', optionD: '8', correctIndex: 2, explanation: 'Six legal deliveries make an over in the modern game.' },
  { question: 'In golf, what is a score of three under par on one hole called?', optionA: 'Birdie', optionB: 'Eagle', optionC: 'Albatross', optionD: 'Bogey', correctIndex: 2, explanation: 'Three under par is an albatross, also called a double eagle.' },
  { question: 'How many interlocking rings appear on the Olympic flag?', optionA: '4', optionB: '5', optionC: '6', optionD: '7', correctIndex: 1, explanation: 'Five rings represent the union of the inhabited continents.' },
  { question: 'In which city were the first modern Olympic Games held?', optionA: 'Paris', optionB: 'London', optionC: 'Athens', optionD: 'Rome', correctIndex: 2, explanation: 'Athens hosted the first modern Games in 1896.' },
  { question: 'In which sport would you perform a slam dunk?', optionA: 'Volleyball', optionB: 'Basketball', optionC: 'Handball', optionD: 'Netball', correctIndex: 1, explanation: 'A dunk is scored by pushing the ball down through the basket by hand.' },
  { question: 'What is the official distance of a marathon?', optionA: '38.4 km', optionB: '40.0 km', optionC: '42.195 km', optionD: '45.5 km', correctIndex: 2, explanation: '42.195 km, or 26 miles 385 yards, fixed as standard in 1921.' },
  { question: 'How many players from one team are on court in indoor volleyball?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 1, explanation: 'Six per side, rotating positions after winning serve back.' },
  { question: 'How many rounds are in a modern professional world title boxing bout?', optionA: '8', optionB: '10', optionC: '12', optionD: '15', correctIndex: 2, explanation: 'Championship bouts were reduced from 15 to 12 rounds in the 1980s.' },
  { question: 'What is the maximum score in a single game of ten-pin bowling?', optionA: '200', optionB: '250', optionC: '300', optionD: '360', correctIndex: 2, explanation: 'Twelve consecutive strikes gives a perfect game of 300.' },
  { question: 'In cricket, what does LBW stand for?', optionA: 'Leg Behind Wicket', optionB: 'Leg Before Wicket', optionC: 'Long Ball Wide', optionD: 'Left Bat Wicket', correctIndex: 1, explanation: 'A batter is out if the ball would have hit the stumps but struck the leg first.' },
  { question: 'How many Grand Slam tournaments are held in tennis each year?', optionA: '3', optionB: '4', optionC: '5', optionD: '6', correctIndex: 1, explanation: 'The Australian Open, French Open, Wimbledon and US Open.' },
  { question: 'Which of these is NOT a tennis Grand Slam tournament?', optionA: 'Wimbledon', optionB: 'US Open', optionC: 'French Open', optionD: 'Davis Cup', correctIndex: 3, explanation: 'The Davis Cup is a team competition, not one of the four majors.' },
  { question: 'Which flag signals the end of a Formula 1 race?', optionA: 'Yellow flag', optionB: 'Red flag', optionC: 'Chequered flag', optionD: 'Blue flag', correctIndex: 2, explanation: 'The black-and-white chequered flag marks the finish.' },
  { question: 'How many players are in a rugby union team on the field?', optionA: '13', optionB: '15', optionC: '11', optionD: '18', correctIndex: 1, explanation: 'Fifteen in rugby union; rugby league uses thirteen.' },
  { question: 'How long is an Olympic swimming pool?', optionA: '25 metres', optionB: '50 metres', optionC: '75 metres', optionD: '100 metres', correctIndex: 1, explanation: 'Olympic events are swum in a 50-metre long-course pool.' },
  { question: 'In which sport is the Ryder Cup contested?', optionA: 'Tennis', optionB: 'Golf', optionC: 'Sailing', optionD: 'Cycling', correctIndex: 1, explanation: 'The Ryder Cup is a team golf match between Europe and the United States.' },
  { question: 'In which sport is the Ashes contested?', optionA: 'Rugby', optionB: 'Cricket', optionC: 'Hockey', optionD: 'Rowing', correctIndex: 1, explanation: 'The Ashes is a Test cricket series between England and Australia.' },
  { question: 'How many points is a field goal worth in American football?', optionA: '1', optionB: '2', optionC: '3', optionD: '6', correctIndex: 2, explanation: 'A successful field goal is three points.' },
  { question: 'How many players per team are on the ice in ice hockey?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 1, explanation: 'Six, including the goaltender, at full strength.' },
  { question: 'What is the maximum break in a standard frame of snooker?', optionA: '127', optionB: '147', optionC: '155', optionD: '167', correctIndex: 1, explanation: '147 comes from clearing 15 reds with blacks, then all the colours.' },
  { question: 'How many minutes are in a full professional football (soccer) match?', optionA: '80', optionB: '90', optionC: '100', optionD: '120', correctIndex: 1, explanation: 'Two halves of 45 minutes, plus stoppage time.' },
  { question: 'In baseball, how many strikes make a strikeout?', optionA: '2', optionB: '3', optionC: '4', optionD: '5', correctIndex: 1, explanation: 'Three strikes and the batter is out.' },
  { question: 'How many bases are there on a baseball diamond?', optionA: '3', optionB: '4', optionC: '5', optionD: '6', correctIndex: 1, explanation: 'First, second, third and home plate.' },
  { question: 'What does NBA stand for?', optionA: 'National Basketball Association', optionB: 'North Basketball Alliance', optionC: 'National Ball Association', optionD: 'National Basket Assembly', correctIndex: 0, explanation: 'The National Basketball Association is the top professional league in North America.' },
  { question: 'In which sport is a shuttlecock used?', optionA: 'Squash', optionB: 'Badminton', optionC: 'Table tennis', optionD: 'Padel', correctIndex: 1, explanation: 'Badminton uses a feathered or synthetic shuttlecock instead of a ball.' },
  { question: 'How many players per team are on court in netball?', optionA: '5', optionB: '6', optionC: '7', optionD: '9', correctIndex: 2, explanation: 'Seven per side, each restricted to certain areas of the court.' },
  { question: 'Which sport is regarded as Japan’s traditional national sport?', optionA: 'Judo', optionB: 'Sumo wrestling', optionC: 'Kendo', optionD: 'Karate', correctIndex: 1, explanation: 'Sumo has centuries-old ritual roots and is considered Japan’s national sport.' },
  { question: 'What colour jersey does the overall Tour de France leader wear?', optionA: 'Green', optionB: 'Yellow', optionC: 'White', optionD: 'Polka dot', correctIndex: 1, explanation: 'The maillot jaune marks the leader on general classification.' },
  { question: 'Which Tour de France jersey marks the best climber?', optionA: 'Green', optionB: 'Yellow', optionC: 'Polka dot', optionD: 'White', correctIndex: 2, explanation: 'The red polka-dot jersey goes to the King of the Mountains.' },
  { question: 'In which sport is a score of “love” used?', optionA: 'Cricket', optionB: 'Tennis', optionC: 'Golf', optionD: 'Snooker', correctIndex: 1, explanation: 'In tennis, love means a score of zero.' },
  { question: 'How many squares are on a standard chessboard?', optionA: '36', optionB: '49', optionC: '64', optionD: '81', correctIndex: 2, explanation: 'An eight-by-eight grid gives 64 squares.' },
  { question: 'In chess, which piece moves only diagonally?', optionA: 'Rook', optionB: 'Knight', optionC: 'Bishop', optionD: 'King', correctIndex: 2, explanation: 'A bishop moves any number of squares diagonally.' },
  { question: 'What is the object slid down the ice in curling called?', optionA: 'Puck', optionB: 'Stone', optionC: 'Disc', optionD: 'Bowl', correctIndex: 1, explanation: 'Curling stones are polished granite, weighing about 20 kg.' },
  { question: 'How many swimmers contest a standard Olympic swimming final?', optionA: '6', optionB: '8', optionC: '10', optionD: '12', correctIndex: 1, explanation: 'Eight finalists race in eight competition lanes.' },
  { question: 'In which country did taekwondo originate?', optionA: 'Japan', optionB: 'China', optionC: 'Korea', optionD: 'Thailand', correctIndex: 2, explanation: 'Taekwondo developed in Korea and is now an Olympic sport.' },
  { question: 'What are three consecutive strikes in bowling called?', optionA: 'A hat-trick', optionB: 'A turkey', optionC: 'A triple', optionD: 'A split', correctIndex: 1, explanation: 'Three strikes in a row is traditionally called a turkey.' },
  { question: 'How many events make up the men’s Olympic decathlon?', optionA: '7', optionB: '8', optionC: '10', optionD: '12', correctIndex: 2, explanation: 'Ten track and field events contested over two days.' },
  { question: 'In which sport is the Stanley Cup awarded?', optionA: 'Basketball', optionB: 'Baseball', optionC: 'Ice hockey', optionD: 'American football', correctIndex: 2, explanation: 'The Stanley Cup goes to the NHL playoff champion.' },
  { question: 'In which sport would you use a foil, épée or sabre?', optionA: 'Archery', optionB: 'Fencing', optionC: 'Shooting', optionD: 'Javelin', correctIndex: 1, explanation: 'These are the three weapons of competitive fencing.' },
  { question: 'How many periods are in a standard ice hockey game?', optionA: '2', optionB: '3', optionC: '4', optionD: '5', correctIndex: 1, explanation: 'Three periods of 20 minutes each.' },
  { question: 'What is the term for scoring three goals in one football match?', optionA: 'Treble', optionB: 'Hat-trick', optionC: 'Triple play', optionD: 'Trifecta', correctIndex: 1, explanation: 'A hat-trick is three goals by one player in a single match.' },
  { question: 'How many players are on a water polo team in the water?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 2, explanation: 'Seven per side, including the goalkeeper.' },
];

const ENTERTAINMENT: Omit<SeedQuizQuestion, 'category'>[] = [
  { question: 'Who directed the 1975 film “Jaws”?', optionA: 'George Lucas', optionB: 'Steven Spielberg', optionC: 'Martin Scorsese', optionD: 'Francis Ford Coppola', correctIndex: 1, explanation: 'Jaws was Spielberg’s breakthrough and helped invent the summer blockbuster.' },
  { question: 'Which film won the first Academy Award for Best Picture?', optionA: 'Wings', optionB: 'Sunrise', optionC: 'The Jazz Singer', optionD: 'Metropolis', correctIndex: 0, explanation: 'Wings, a silent war film, won at the first Oscars ceremony in 1929.' },
  { question: 'Who played Jack Dawson in “Titanic” (1997)?', optionA: 'Brad Pitt', optionB: 'Leonardo DiCaprio', optionC: 'Matt Damon', optionD: 'Johnny Depp', correctIndex: 1, explanation: 'DiCaprio starred opposite Kate Winslet in James Cameron’s film.' },
  { question: 'Which band released the album “Abbey Road”?', optionA: 'The Rolling Stones', optionB: 'The Beatles', optionC: 'Pink Floyd', optionD: 'The Who', correctIndex: 1, explanation: 'Abbey Road, released in 1969, was the last album the Beatles recorded together.' },
  { question: 'How many strings does a standard acoustic guitar have?', optionA: '4', optionB: '5', optionC: '6', optionD: '7', correctIndex: 2, explanation: 'Six strings, usually tuned E-A-D-G-B-E.' },
  { question: 'Who composed “The Four Seasons”?', optionA: 'Johann Sebastian Bach', optionB: 'Antonio Vivaldi', optionC: 'Joseph Haydn', optionD: 'George Handel', correctIndex: 1, explanation: 'Vivaldi wrote the four violin concertos around 1720.' },
  { question: 'Which studio produced “Toy Story”, the first fully computer-animated feature?', optionA: 'DreamWorks', optionB: 'Pixar', optionC: 'Blue Sky', optionD: 'Illumination', correctIndex: 1, explanation: 'Pixar released Toy Story in 1995.' },
  { question: 'Who wrote the Harry Potter novels?', optionA: 'Philip Pullman', optionB: 'J. R. R. Tolkien', optionC: 'J. K. Rowling', optionD: 'C. S. Lewis', correctIndex: 2, explanation: 'Rowling published the first book, Philosopher’s Stone, in 1997.' },
  { question: 'Which musical features the song “Memory”?', optionA: 'Cats', optionB: 'Evita', optionC: 'Chicago', optionD: 'Rent', correctIndex: 0, explanation: 'Memory is the best-known song from Andrew Lloyd Webber’s Cats.' },
  { question: 'Who wrote the play “Romeo and Juliet”?', optionA: 'Christopher Marlowe', optionB: 'William Shakespeare', optionC: 'Ben Jonson', optionD: 'John Webster', correctIndex: 1, explanation: 'Shakespeare wrote the tragedy in the mid-1590s.' },
  { question: 'In which city is the sitcom “Friends” set?', optionA: 'Chicago', optionB: 'Boston', optionC: 'New York', optionD: 'Seattle', correctIndex: 2, explanation: 'The six friends live in Manhattan, New York City.' },
  { question: 'Who directed “Pulp Fiction”?', optionA: 'Quentin Tarantino', optionB: 'Robert Rodriguez', optionC: 'David Fincher', optionD: 'Guy Ritchie', correctIndex: 0, explanation: 'Tarantino’s 1994 film won the Palme d’Or at Cannes.' },
  { question: 'Which instrument has 88 keys?', optionA: 'Organ', optionB: 'Harpsichord', optionC: 'Piano', optionD: 'Accordion', correctIndex: 2, explanation: 'A modern full-size piano has 88 keys, 52 white and 36 black.' },
  { question: 'Which film contains the line “Here’s looking at you, kid”?', optionA: 'Gone with the Wind', optionB: 'Casablanca', optionC: 'Citizen Kane', optionD: 'The Maltese Falcon', correctIndex: 1, explanation: 'Humphrey Bogart delivers the line in Casablanca (1942).' },
  { question: 'Who provided the original voice of Darth Vader?', optionA: 'James Earl Jones', optionB: 'Morgan Freeman', optionC: 'Orson Welles', optionD: 'Christopher Lee', correctIndex: 0, explanation: 'James Earl Jones voiced Vader, while David Prowse wore the suit.' },
  { question: 'In which fictional town is “Stranger Things” set?', optionA: 'Derry', optionB: 'Hawkins', optionC: 'Twin Peaks', optionD: 'Riverdale', correctIndex: 1, explanation: 'The series is set in Hawkins, Indiana, in the 1980s.' },
  { question: 'Which musician is known as the “King of Pop”?', optionA: 'Elvis Presley', optionB: 'Prince', optionC: 'Michael Jackson', optionD: 'David Bowie', correctIndex: 2, explanation: 'The title is strongly associated with Michael Jackson.' },
  { question: 'Which Beatle was nicknamed the “quiet Beatle”?', optionA: 'John Lennon', optionB: 'Paul McCartney', optionC: 'George Harrison', optionD: 'Ringo Starr', correctIndex: 2, explanation: 'George Harrison earned the nickname for his reserved public manner.' },
  { question: 'The “Oscar” is the nickname of which award?', optionA: 'Academy Award', optionB: 'Golden Globe', optionC: 'BAFTA', optionD: 'Palme d’Or', correctIndex: 0, explanation: 'Oscar is the popular name for the Academy Award statuette.' },
  { question: 'Who directed the 1960 thriller “Psycho”?', optionA: 'Alfred Hitchcock', optionB: 'Billy Wilder', optionC: 'Stanley Kubrick', optionD: 'Orson Welles', correctIndex: 0, explanation: 'Hitchcock’s Psycho reshaped the horror and thriller genres.' },
  { question: 'How many white keys are there in one octave on a piano?', optionA: '5', optionB: '7', optionC: '8', optionD: '12', correctIndex: 1, explanation: 'Seven white keys and five black keys make up an octave’s twelve semitones.' },
  { question: 'Which opera features the aria “Nessun dorma”?', optionA: 'Aida', optionB: 'Carmen', optionC: 'Turandot', optionD: 'Tosca', correctIndex: 2, explanation: 'Puccini wrote Nessun dorma for his final opera, Turandot.' },
  { question: 'Who composed the opera “The Magic Flute”?', optionA: 'Wolfgang Amadeus Mozart', optionB: 'Richard Wagner', optionC: 'Giuseppe Verdi', optionD: 'Ludwig van Beethoven', correctIndex: 0, explanation: 'Mozart completed Die Zauberflöte in 1791, the year he died.' },
  { question: 'Which film won Best Picture at the 2020 Academy Awards?', optionA: '1917', optionB: 'Joker', optionC: 'Parasite', optionD: 'Once Upon a Time in Hollywood', correctIndex: 2, explanation: 'Parasite was the first non-English-language film to win Best Picture.' },
  { question: 'Who directed “Parasite”?', optionA: 'Park Chan-wook', optionB: 'Bong Joon-ho', optionC: 'Kim Ki-duk', optionD: 'Lee Chang-dong', correctIndex: 1, explanation: 'Bong Joon-ho also won Best Director for the film.' },
  { question: 'Which film franchise features the character Ethan Hunt?', optionA: 'James Bond', optionB: 'Jason Bourne', optionC: 'Mission: Impossible', optionD: 'John Wick', correctIndex: 2, explanation: 'Tom Cruise has played Ethan Hunt since 1996.' },
  { question: 'Which writer co-created Marvel characters including Spider-Man?', optionA: 'Stan Lee', optionB: 'Bob Kane', optionC: 'Jerry Siegel', optionD: 'Frank Miller', correctIndex: 0, explanation: 'Stan Lee co-created Spider-Man with artist Steve Ditko in 1962.' },
  { question: 'Which company created the character Mickey Mouse?', optionA: 'Warner Bros.', optionB: 'Disney', optionC: 'Universal', optionD: 'MGM', correctIndex: 1, explanation: 'Walt Disney and Ub Iwerks introduced Mickey in 1928.' },
  { question: 'What is the name of the wizarding school in Harry Potter?', optionA: 'Beauxbatons', optionB: 'Durmstrang', optionC: 'Hogwarts', optionD: 'Ilvermorny', correctIndex: 2, explanation: 'Hogwarts School of Witchcraft and Wizardry is the main setting.' },
  { question: 'Which television series features a contest for the Iron Throne?', optionA: 'The Witcher', optionB: 'Game of Thrones', optionC: 'Vikings', optionD: 'The Last Kingdom', correctIndex: 1, explanation: 'The Iron Throne is the central prize in Game of Thrones.' },
  { question: 'Which artist recorded the album “Thriller”?', optionA: 'Prince', optionB: 'Lionel Richie', optionC: 'Michael Jackson', optionD: 'Stevie Wonder', correctIndex: 2, explanation: 'Thriller, released in 1982, is among the best-selling albums ever made.' },
  { question: 'Which is the longest-running American primetime animated sitcom?', optionA: 'Family Guy', optionB: 'South Park', optionC: 'The Simpsons', optionD: 'King of the Hill', correctIndex: 2, explanation: 'The Simpsons has aired since 1989.' },
  { question: 'Which instrument was Louis Armstrong famous for playing?', optionA: 'Saxophone', optionB: 'Trumpet', optionC: 'Clarinet', optionD: 'Piano', correctIndex: 1, explanation: 'Armstrong was a pioneering jazz trumpeter and singer.' },
  { question: 'Which country’s Hindi-language film industry is nicknamed “Bollywood”?', optionA: 'Pakistan', optionB: 'India', optionC: 'Bangladesh', optionD: 'Sri Lanka', correctIndex: 1, explanation: 'The name blends Bombay, now Mumbai, with Hollywood.' },
  { question: 'Who directed “Schindler’s List”?', optionA: 'Steven Spielberg', optionB: 'Roman Polanski', optionC: 'Oliver Stone', optionD: 'Ridley Scott', correctIndex: 0, explanation: 'Spielberg won Best Director and Best Picture for the 1993 film.' },
  { question: 'Which actor played the title role in “Forrest Gump”?', optionA: 'Tom Hanks', optionB: 'Kevin Costner', optionC: 'Robin Williams', optionD: 'Bill Murray', correctIndex: 0, explanation: 'Tom Hanks won his second consecutive Best Actor Oscar for the role.' },
  { question: 'Which band recorded “Bohemian Rhapsody”?', optionA: 'Led Zeppelin', optionB: 'Queen', optionC: 'The Kinks', optionD: 'Deep Purple', correctIndex: 1, explanation: 'Queen released the six-minute track in 1975.' },
  { question: 'Who was the lead singer of Queen?', optionA: 'Freddie Mercury', optionB: 'Robert Plant', optionC: 'Roger Daltrey', optionD: 'Mick Jagger', correctIndex: 0, explanation: 'Freddie Mercury fronted the band from 1970 until 1991.' },
  { question: 'To which instrument family does the cello belong?', optionA: 'Brass', optionB: 'Woodwind', optionC: 'Strings', optionD: 'Percussion', correctIndex: 2, explanation: 'The cello is a bowed string instrument, below the viola in range.' },
  { question: 'Which film series centres on a quest to destroy the One Ring?', optionA: 'The Chronicles of Narnia', optionB: 'The Lord of the Rings', optionC: 'Eragon', optionD: 'The Dark Tower', correctIndex: 1, explanation: 'Peter Jackson’s trilogy adapts Tolkien’s novel.' },
  { question: 'Who wrote “The Lord of the Rings”?', optionA: 'C. S. Lewis', optionB: 'J. R. R. Tolkien', optionC: 'Ursula K. Le Guin', optionD: 'Terry Pratchett', correctIndex: 1, explanation: 'Tolkien published the work in three volumes in 1954–55.' },
  { question: 'In which film does a character famously say “I’ll be back”?', optionA: 'RoboCop', optionB: 'The Terminator', optionC: 'Predator', optionD: 'Total Recall', correctIndex: 1, explanation: 'Arnold Schwarzenegger delivers the line in The Terminator (1984).' },
  { question: 'Which actor played the Joker in “The Dark Knight”?', optionA: 'Jack Nicholson', optionB: 'Joaquin Phoenix', optionC: 'Heath Ledger', optionD: 'Jared Leto', correctIndex: 2, explanation: 'Ledger won a posthumous Academy Award for the performance.' },
  { question: 'Which studio produced the animated film “Spirited Away”?', optionA: 'Studio Ghibli', optionB: 'Toei Animation', optionC: 'Madhouse', optionD: 'Kyoto Animation', correctIndex: 0, explanation: 'Studio Ghibli’s film won the Academy Award for Best Animated Feature.' },
  { question: 'Who directed “Spirited Away”?', optionA: 'Isao Takahata', optionB: 'Hayao Miyazaki', optionC: 'Makoto Shinkai', optionD: 'Satoshi Kon', correctIndex: 1, explanation: 'Miyazaki co-founded Studio Ghibli and directed the 2001 film.' },
  { question: 'Which dance originated in Argentina?', optionA: 'Samba', optionB: 'Flamenco', optionC: 'Tango', optionD: 'Salsa', correctIndex: 2, explanation: 'Tango emerged in the Río de la Plata region around Buenos Aires.' },
  { question: 'Which award honours excellence in Broadway theatre?', optionA: 'Tony Award', optionB: 'Emmy Award', optionC: 'Grammy Award', optionD: 'Olivier Award', correctIndex: 0, explanation: 'The Tony Awards recognise Broadway productions; the Oliviers cover London.' },
  { question: 'Which award recognises achievement in music recording?', optionA: 'Emmy', optionB: 'Grammy', optionC: 'Tony', optionD: 'Oscar', correctIndex: 1, explanation: 'The Grammy Awards are presented by the Recording Academy.' },
  { question: 'Which four awards make up an EGOT?', optionA: 'Emmy, Grammy, Oscar, Tony', optionB: 'Emmy, Globe, Oscar, Tony', optionC: 'Emmy, Grammy, Olivier, Tony', optionD: 'Emmy, Grammy, Oscar, Turner', correctIndex: 0, explanation: 'Winning all four is one of entertainment’s rarest achievements.' },
  { question: 'Which film first introduced the character Indiana Jones?', optionA: 'The Temple of Doom', optionB: 'Raiders of the Lost Ark', optionC: 'The Last Crusade', optionD: 'The Kingdom of the Crystal Skull', correctIndex: 1, explanation: 'Raiders of the Lost Ark introduced the character in 1981.' },
];

const GENERAL_KNOWLEDGE: Omit<SeedQuizQuestion, 'category'>[] = [
  { question: 'What is the chemical symbol for gold?', optionA: 'Go', optionB: 'Gd', optionC: 'Au', optionD: 'Ag', correctIndex: 2, explanation: 'Au comes from the Latin aurum. Ag is silver.' },
  { question: 'How many continents are there?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 2, explanation: 'Conventionally seven: Africa, Antarctica, Asia, Australia, Europe, North and South America.' },
  { question: 'Which is the largest planet in the Solar System?', optionA: 'Saturn', optionB: 'Jupiter', optionC: 'Neptune', optionD: 'Uranus', correctIndex: 1, explanation: 'Jupiter’s mass is greater than all the other planets combined.' },
  { question: 'What is the capital of Australia?', optionA: 'Sydney', optionB: 'Melbourne', optionC: 'Canberra', optionD: 'Perth', correctIndex: 2, explanation: 'Canberra was purpose-built as the capital, settling Sydney–Melbourne rivalry.' },
  { question: 'Which is the longest river in Africa?', optionA: 'Congo', optionB: 'Nile', optionC: 'Niger', optionD: 'Zambezi', correctIndex: 1, explanation: 'The Nile runs about 6,650 km through north-east Africa.' },
  { question: 'Which is the smallest country in the world by area?', optionA: 'Monaco', optionB: 'Nauru', optionC: 'San Marino', optionD: 'Vatican City', correctIndex: 3, explanation: 'Vatican City covers roughly 0.49 square kilometres.' },
  { question: 'How many bones are in the adult human body?', optionA: '186', optionB: '206', optionC: '226', optionD: '246', correctIndex: 1, explanation: 'Adults have 206; babies are born with about 270, which fuse over time.' },
  { question: 'Which gas do plants absorb from the air for photosynthesis?', optionA: 'Oxygen', optionB: 'Nitrogen', optionC: 'Carbon dioxide', optionD: 'Hydrogen', correctIndex: 2, explanation: 'Plants take in carbon dioxide and release oxygen.' },
  { question: 'What is the hardest naturally occurring substance on Earth?', optionA: 'Quartz', optionB: 'Diamond', optionC: 'Corundum', optionD: 'Topaz', correctIndex: 1, explanation: 'Diamond sits at 10, the top of the Mohs hardness scale.' },
  { question: 'Who developed the theory of general relativity?', optionA: 'Isaac Newton', optionB: 'Niels Bohr', optionC: 'Albert Einstein', optionD: 'Max Planck', correctIndex: 2, explanation: 'Einstein published general relativity in 1915.' },
  { question: 'What is the chemical formula for water?', optionA: 'CO2', optionB: 'H2O', optionC: 'O2', optionD: 'NaCl', correctIndex: 1, explanation: 'Two hydrogen atoms bonded to one oxygen atom.' },
  { question: 'How many planets are in the Solar System?', optionA: '7', optionB: '8', optionC: '9', optionD: '10', correctIndex: 1, explanation: 'Eight, since Pluto was reclassified as a dwarf planet in 2006.' },
  { question: 'Which is the largest ocean on Earth?', optionA: 'Atlantic', optionB: 'Indian', optionC: 'Pacific', optionD: 'Arctic', correctIndex: 2, explanation: 'The Pacific covers about a third of the planet’s surface.' },
  { question: 'What is the capital of Japan?', optionA: 'Osaka', optionB: 'Kyoto', optionC: 'Tokyo', optionD: 'Nagoya', correctIndex: 2, explanation: 'Tokyo has been the capital since 1868, replacing Kyoto.' },
  { question: 'Which organ pumps blood around the human body?', optionA: 'Liver', optionB: 'Heart', optionC: 'Lungs', optionD: 'Kidney', correctIndex: 1, explanation: 'The heart is a muscular pump driving the circulatory system.' },
  { question: 'At sea level, what is the boiling point of water in Celsius?', optionA: '90°', optionB: '95°', optionC: '100°', optionD: '110°', correctIndex: 2, explanation: '100°C at standard atmospheric pressure; it falls at altitude.' },
  { question: 'What is the freezing point of water in Fahrenheit?', optionA: '0°', optionB: '32°', optionC: '48°', optionD: '100°', correctIndex: 1, explanation: '32°F equals 0°C.' },
  { question: 'Who painted the Mona Lisa?', optionA: 'Michelangelo', optionB: 'Raphael', optionC: 'Leonardo da Vinci', optionD: 'Donatello', correctIndex: 2, explanation: 'Leonardo painted it in the early 1500s; it hangs in the Louvre.' },
  { question: 'Which planet is known as the Red Planet?', optionA: 'Venus', optionB: 'Mars', optionC: 'Mercury', optionD: 'Jupiter', correctIndex: 1, explanation: 'Iron oxide dust gives Mars its reddish colour.' },
  { question: 'What is the currency of Japan?', optionA: 'Won', optionB: 'Yuan', optionC: 'Yen', optionD: 'Baht', correctIndex: 2, explanation: 'The yen has been Japan’s currency since 1871.' },
  { question: 'How many sides does a hexagon have?', optionA: '5', optionB: '6', optionC: '7', optionD: '8', correctIndex: 1, explanation: 'Hexa means six in Greek.' },
  { question: 'What is the square root of 144?', optionA: '11', optionB: '12', optionC: '13', optionD: '14', correctIndex: 1, explanation: '12 × 12 = 144.' },
  { question: 'Which vitamin does the body produce when exposed to sunlight?', optionA: 'Vitamin A', optionB: 'Vitamin B12', optionC: 'Vitamin C', optionD: 'Vitamin D', correctIndex: 3, explanation: 'Skin synthesises vitamin D from ultraviolet B light.' },
  { question: 'What is the largest animal on Earth?', optionA: 'African elephant', optionB: 'Blue whale', optionC: 'Giraffe', optionD: 'Colossal squid', correctIndex: 1, explanation: 'The blue whale is the largest animal known to have existed.' },
  { question: 'How many teeth does a typical adult human have?', optionA: '28', optionB: '30', optionC: '32', optionD: '36', correctIndex: 2, explanation: '32 including the four wisdom teeth.' },
  { question: 'What is the chemical symbol for iron?', optionA: 'Ir', optionB: 'In', optionC: 'Fe', optionD: 'Fr', correctIndex: 2, explanation: 'Fe comes from the Latin ferrum.' },
  { question: 'Which is the highest mountain above sea level?', optionA: 'K2', optionB: 'Kangchenjunga', optionC: 'Mount Everest', optionD: 'Denali', correctIndex: 2, explanation: 'Everest reaches about 8,849 metres above sea level.' },
  { question: 'Which desert covers much of northern Africa?', optionA: 'Kalahari', optionB: 'Sahara', optionC: 'Gobi', optionD: 'Atacama', correctIndex: 1, explanation: 'The Sahara is the world’s largest hot desert.' },
  { question: 'How many degrees are in a right angle?', optionA: '45', optionB: '90', optionC: '180', optionD: '360', correctIndex: 1, explanation: 'A right angle is a quarter turn, or 90 degrees.' },
  { question: 'Which blood type is known as the universal donor?', optionA: 'AB positive', optionB: 'A negative', optionC: 'O negative', optionD: 'B positive', correctIndex: 2, explanation: 'O negative red cells lack A, B and Rh antigens.' },
  { question: 'What does DNA stand for?', optionA: 'Deoxyribonucleic acid', optionB: 'Dinucleic acid', optionC: 'Deoxyribose nucleotide', optionD: 'Diribonucleic acid', correctIndex: 0, explanation: 'DNA carries genetic instructions in nearly all living organisms.' },
  { question: 'Approximately how fast does light travel in a vacuum?', optionA: '300 km/s', optionB: '3,000 km/s', optionC: '30,000 km/s', optionD: '300,000 km/s', correctIndex: 3, explanation: 'About 299,792 kilometres per second.' },
  { question: 'Which metal is liquid at room temperature?', optionA: 'Mercury', optionB: 'Lead', optionC: 'Tin', optionD: 'Zinc', correctIndex: 0, explanation: 'Mercury melts at about −39°C, so it is liquid at room temperature.' },
  { question: 'What is the capital of Canada?', optionA: 'Toronto', optionB: 'Vancouver', optionC: 'Ottawa', optionD: 'Montreal', correctIndex: 2, explanation: 'Ottawa, in Ontario, was chosen as capital in 1857.' },
  { question: 'Which is the largest country in the world by land area?', optionA: 'Canada', optionB: 'China', optionC: 'United States', optionD: 'Russia', correctIndex: 3, explanation: 'Russia spans about 17 million square kilometres across two continents.' },
  { question: 'How many colours are traditionally listed in a rainbow?', optionA: '5', optionB: '6', optionC: '7', optionD: '9', correctIndex: 2, explanation: 'Red, orange, yellow, green, blue, indigo and violet.' },
  { question: 'Which gas is most abundant in Earth’s atmosphere?', optionA: 'Oxygen', optionB: 'Nitrogen', optionC: 'Carbon dioxide', optionD: 'Argon', correctIndex: 1, explanation: 'Nitrogen makes up about 78% of the atmosphere.' },
  { question: 'Who is generally credited with inventing the telephone?', optionA: 'Thomas Edison', optionB: 'Alexander Graham Bell', optionC: 'Nikola Tesla', optionD: 'Guglielmo Marconi', correctIndex: 1, explanation: 'Bell received the first US patent for the telephone in 1876.' },
  { question: 'What is the scientific study of earthquakes called?', optionA: 'Seismology', optionB: 'Geology', optionC: 'Volcanology', optionD: 'Meteorology', correctIndex: 0, explanation: 'Seismology studies earthquakes and the propagation of elastic waves.' },
  { question: 'How many strings does a standard violin have?', optionA: '4', optionB: '5', optionC: '6', optionD: '7', correctIndex: 0, explanation: 'Four strings, tuned G-D-A-E.' },
  { question: 'What is the largest internal organ in the human body?', optionA: 'Brain', optionB: 'Liver', optionC: 'Lungs', optionD: 'Stomach', correctIndex: 1, explanation: 'The liver is the largest internal organ; the skin is the largest organ overall.' },
  { question: 'What is the smallest prime number?', optionA: '0', optionB: '1', optionC: '2', optionD: '3', correctIndex: 2, explanation: '2 is the smallest prime, and the only even one.' },
  { question: 'What is the capital of Brazil?', optionA: 'Rio de Janeiro', optionB: 'São Paulo', optionC: 'Brasília', optionD: 'Salvador', correctIndex: 2, explanation: 'Brasília was purpose-built and became the capital in 1960.' },
  { question: 'Which body of water is so salty that swimmers float easily?', optionA: 'Black Sea', optionB: 'Dead Sea', optionC: 'Red Sea', optionD: 'Caspian Sea', correctIndex: 1, explanation: 'The Dead Sea’s extreme salinity makes water far denser than the human body.' },
  { question: 'What is the SI unit of electrical resistance?', optionA: 'Volt', optionB: 'Ampere', optionC: 'Ohm', optionD: 'Watt', correctIndex: 2, explanation: 'Resistance is measured in ohms, named after Georg Ohm.' },
  { question: 'Who wrote “On the Origin of Species”?', optionA: 'Gregor Mendel', optionB: 'Charles Darwin', optionC: 'Alfred Russel Wallace', optionD: 'Carl Linnaeus', correctIndex: 1, explanation: 'Darwin published it in 1859, setting out evolution by natural selection.' },
  { question: 'How many minutes are in a full day?', optionA: '1,200', optionB: '1,440', optionC: '1,600', optionD: '2,400', correctIndex: 1, explanation: '24 hours × 60 minutes = 1,440.' },
  { question: 'What is the chemical symbol for sodium?', optionA: 'So', optionB: 'Sd', optionC: 'Na', optionD: 'Ne', correctIndex: 2, explanation: 'Na comes from the Latin natrium. Ne is neon.' },
  { question: 'Which is the fastest land animal over a short distance?', optionA: 'Lion', optionB: 'Cheetah', optionC: 'Pronghorn', optionD: 'Greyhound', correctIndex: 1, explanation: 'A cheetah can reach roughly 100 km/h in short bursts.' },
  { question: 'What is the capital of Egypt?', optionA: 'Alexandria', optionB: 'Cairo', optionC: 'Giza', optionD: 'Luxor', correctIndex: 1, explanation: 'Cairo, on the Nile, is Egypt’s capital and largest city.' },
];

/**
 * Rotates one question's four options so the correct answer ends up at
 * `target`, leaving the option text itself untouched.
 */
function rotateTo(
  q: Omit<SeedQuizQuestion, 'category'>,
  target: number,
): Omit<SeedQuizQuestion, 'category'> {
  const options = [q.optionA, q.optionB, q.optionC, q.optionD];
  const shift = (target - q.correctIndex + 4) % 4;
  if (shift === 0) return q;
  const rotated = new Array<string>(4);
  options.forEach((opt, i) => {
    rotated[(i + shift) % 4] = opt;
  });
  return {
    ...q,
    optionA: rotated[0],
    optionB: rotated[1],
    optionC: rotated[2],
    optionD: rotated[3],
    correctIndex: target,
  };
}

/**
 * Hand-authoring these left the correct answer clustered on option B — about
 * half of all questions. That is directly exploitable: always picking B would
 * put a player right on the 50% win threshold. This cycles the correct index
 * 0,1,2,3 evenly through each category so no single position pays off.
 *
 * Side effect: numeric option sets are no longer always ascending. That is a
 * cosmetic trade for removing a real scoring exploit.
 */
function withCategory(
  category: SeedQuizCategory,
  items: Omit<SeedQuizQuestion, 'category'>[],
): SeedQuizQuestion[] {
  return items.map((q, i) => ({ ...rotateTo(q, i % 4), category }));
}

export const QUIZ_QUESTIONS: SeedQuizQuestion[] = [
  ...withCategory('POLITICS', POLITICS),
  ...withCategory('SPORTS', SPORTS),
  ...withCategory('ENTERTAINMENT', ENTERTAINMENT),
  ...withCategory('GENERAL_KNOWLEDGE', GENERAL_KNOWLEDGE),
];
