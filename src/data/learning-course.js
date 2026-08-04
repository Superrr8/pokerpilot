'use strict';

(function attachLearningCourse(root) {
  const choice = (id, label) => ({ id, label });
  const question = (id, topic, prompt, choices, correctChoiceId, explanation) => ({
    id, topic, prompt, choices, correctChoiceId, explanation
  });

  const course = {
    schemaVersion: 1,
    modules: [
      {
        id: 'holdem-foundations',
        order: 1,
        title: 'Основы Texas Hold’em',
        description: 'Правила раздачи, улицы, позиции, блайнды и действия за столом.',
        topics: [
          'цель игры', 'карманные и общие карты', 'улицы', 'позиции и дилер',
          'блайнды', 'действия', 'уникальность карт', 'интерфейс PokerPilot'
        ],
        lessons: [
          {
            id: 'foundations-goal-cards',
            topic: 'карманные и общие карты',
            title: 'Цель игры и семь доступных карт',
            sections: [
              'В Texas Hold’em ты выигрываешь банк, если все соперники сбросили карты или твоя лучшая пятикарточная комбинация сильнее на вскрытии.',
              'Каждый игрок получает две закрытые карманные карты. До пяти общих карт выкладываются на стол и доступны всем оставшимся игрокам.',
              'Для результата используются любые лучшие пять карт из двух карманных и пяти общих. Одна физическая карта не может появиться в раздаче дважды.'
            ],
            coachTip: 'Сначала отдели две карты героя от общей доски, затем ищи лучшую пятёрку без обязательного использования обеих карманных карт.'
          },
          {
            id: 'foundations-streets-blinds',
            topic: 'улицы',
            title: 'Блайнды и порядок улиц',
            sections: [
              'До раздачи малый и большой блайнды вносят обязательные ставки и создают начальный банк.',
              'Префлоп начинается после раздачи двух карманных карт. Затем открываются flop — три карты, turn — четвёртая и river — пятая.',
              'После каждого круга ставок оставшиеся игроки переходят на следующую улицу. После ривера возможен showdown.'
            ],
            coachTip: 'Запомни ритм: preflop → flop (3 карты) → turn (1) → river (1).'
          },
          {
            id: 'foundations-positions-actions',
            topic: 'действия',
            title: 'Позиции, кнопка и действия',
            sections: [
              'Кнопка дилера перемещается по часовой стрелке. Позиции определяются относительно кнопки; поздняя позиция обычно даёт больше информации.',
              'Fold прекращает участие в раздаче. Check передаёт ход без ставки, когда платить не нужно. Call уравнивает текущую ставку.',
              'Bet создаёт ставку, raise увеличивает уже сделанную ставку, all-in ставит весь доступный стек.'
            ],
            coachTip: 'Check и bet возможны, когда перед тобой нет ставки; call и raise — когда ставка уже есть.'
          },
          {
            id: 'foundations-pokerpilot-ui',
            topic: 'интерфейс PokerPilot',
            title: 'Как читать PokerPilot',
            sections: [
              'Hand Lab принимает карманные карты, доску, позиции, банк, ставку, effective stack, число и тип соперников.',
              'Учебные ситуации проверяют решение до показа ответа, а «Позиции и диапазоны» тренируют префлоп.',
              'Математический блок отделяет equity, pot odds, EV и ауты от эвристической рекомендации тренера.'
            ],
            coachTip: 'Перед расчётом проверь улицу, уникальность карт и что «банк» и «ставка» введены в правильные поля.'
          }
        ],
        examples: [
          {
            id: 'foundations-example-board',
            title: 'Карманные и общие карты',
            situation: 'У героя A♠ K♠, на столе Q♠ J♦ 4♣.',
            explanation: 'У героя по-прежнему две карманные карты, а три карты флопа общие для всех. До ривера могут появиться ещё две общие карты.'
          },
          {
            id: 'foundations-example-action',
            title: 'Check или call',
            situation: 'На флопе все до героя сделали check.',
            explanation: 'Герою не нужно уравнивать ставку: доступны check или bet. Call здесь физически не требуется.'
          },
          {
            id: 'foundations-example-position',
            title: 'Преимущество кнопки',
            situation: 'Герой на BTN, соперник в BB.',
            explanation: 'После флопа BTN обычно действует после BB и видит действие соперника до своего решения.'
          }
        ],
        tasks: [
          question(
            'foundations-task-card-count', 'карманные и общие карты',
            'Сколько закрытых карманных карт получает игрок в Texas Hold’em?',
            [choice('two', 'Две'), choice('three', 'Три'), choice('five', 'Пять')],
            'two', 'Каждый игрок получает ровно две закрытые карманные карты.'
          ),
          question(
            'foundations-task-street-order', 'улицы',
            'Какая улица идёт сразу после flop?',
            [choice('preflop', 'Preflop'), choice('turn', 'Turn'), choice('river', 'River')],
            'turn', 'После трёх карт flop открывается одна карта turn.'
          ),
          question(
            'foundations-task-facing-bet', 'действия',
            'Перед героем сделана ставка. Какое действие просто уравнивает её?',
            [choice('check', 'Check'), choice('call', 'Call'), choice('bet', 'Bet')],
            'call', 'Call уравнивает ставку. Check недоступен, а bet заменяется raise, когда ставка уже есть.'
          )
        ],
        exam: {
          passingScore: 70,
          questions: [
            question('foundations-exam-goal', 'цель игры', 'Как можно выиграть банк?',
              [choice('only-showdown', 'Только на вскрытии'), choice('fold-or-showdown', 'Получить все fold или выиграть вскрытие'), choice('only-flush', 'Только собрав флеш')],
              'fold-or-showdown', 'Банк выигрывается без вскрытия после всех fold или сильнейшей рукой на showdown.'),
            question('foundations-exam-hole', 'карманные и общие карты', 'Сколько карманных карт у героя?',
              [choice('2', '2'), choice('3', '3'), choice('5', '5')], '2', 'В Hold’em у каждого игрока две карманные карты.'),
            question('foundations-exam-board', 'карманные и общие карты', 'Сколько общих карт может быть к риверу?',
              [choice('3', '3'), choice('4', '4'), choice('5', '5')], '5', 'Flop даёт три, turn и river — ещё по одной карте.'),
            question('foundations-exam-order', 'улицы', 'Выбери правильный порядок улиц.',
              [choice('right', 'Preflop → flop → turn → river'), choice('wrong-a', 'Flop → preflop → river → turn'), choice('wrong-b', 'Preflop → turn → flop → river')],
              'right', 'Стандартный порядок: preflop, flop, turn, river.'),
            question('foundations-exam-blinds', 'блайнды', 'Зачем нужны blinds?',
              [choice('start-pot', 'Создать обязательный начальный банк'), choice('show-cards', 'Открыть карты'), choice('choose-winner', 'Выбрать победителя')],
              'start-pot', 'Small blind и big blind — обязательные ставки до раздачи.'),
            question('foundations-exam-button', 'позиции и дилер', 'Что обозначает BTN?',
              [choice('dealer', 'Позицию кнопки дилера'), choice('big-blind', 'Большой блайнд'), choice('turn', 'Улицу turn')],
              'dealer', 'BTN — позиция dealer button.'),
            question('foundations-exam-check', 'действия', 'Когда допустим check?',
              [choice('no-bet', 'Когда не нужно уравнивать ставку'), choice('always', 'Всегда'), choice('after-allin', 'Только после all-in')],
              'no-bet', 'Check доступен, когда перед героем нет непокрытой ставки.'),
            question('foundations-exam-raise', 'действия', 'Что делает raise?',
              [choice('fold', 'Сбрасывает карты'), choice('increase', 'Увеличивает существующую ставку'), choice('free-card', 'Даёт бесплатную карту')],
              'increase', 'Raise повышает уже сделанную ставку.'),
            question('foundations-exam-duplicate', 'уникальность карт', 'Можно ли указать A♠ одновременно у героя и на доске?',
              [choice('yes', 'Да'), choice('no', 'Нет')], 'no', 'В колоде только одна A♠, поэтому повтор физической карты невозможен.'),
            question('foundations-exam-interface', 'интерфейс PokerPilot', 'Где вручную разобрать известную раздачу?',
              [choice('hand-lab', 'В Hand Lab'), choice('live-only', 'Только в Live Poker'), choice('progress', 'В отчёте прогресса')],
              'hand-lab', 'Hand Lab предназначен для ручного ввода и анализа раздачи.')
          ]
        }
      },
      {
        id: 'hand-rankings',
        order: 2,
        title: 'Комбинации и сравнение рук',
        description: 'Девять категорий, лучшая пятёрка, кикеры и ничьи.',
        topics: [
          'high card', 'one pair', 'two pair', 'three of a kind', 'straight',
          'flush', 'full house', 'four of a kind', 'straight flush',
          'best five of seven', 'кикеры', 'ничьи', 'сравнение рук'
        ],
        lessons: [
          {
            id: 'rankings-high-to-trips',
            topic: 'one pair',
            title: 'От старшей карты до сета',
            sections: [
              'High card: нет пары или более сильной комбинации; сравнение начинается со старшей карты.',
              'One pair содержит две карты одного ранга. Two pair — две разные пары. Three of a kind — три карты одного ранга.',
              'При одинаковой категории сначала сравнивается основной ранг, затем оставшиеся кикеры по порядку.'
            ],
            coachTip: 'Сначала назови категорию, только потом сравнивай ранги внутри неё.'
          },
          {
            id: 'rankings-straight-to-full-house',
            topic: 'straight',
            title: 'Стрит, флеш и фулл-хаус',
            sections: [
              'Straight — пять последовательных рангов; туз может быть старшим в 10-J-Q-K-A или младшим в A-2-3-4-5.',
              'Flush — пять карт одной масти, не обязательно подряд. Флеши сравниваются по старшим картам.',
              'Full house объединяет three of a kind и pair; сначала сравнивается ранг тройки.'
            ],
            coachTip: 'Масть сама по себе не старше другой масти: ♠ не побеждает ♥ только из-за символа.'
          },
          {
            id: 'rankings-quads-straight-flush',
            topic: 'straight flush',
            title: 'Каре и стрит-флеш',
            sections: [
              'Four of a kind — четыре карты одного ранга; пятая карта служит кикером.',
              'Straight flush — пять последовательных карт одной масти и самая высокая категория в обычном Hold’em.',
              'Любая более высокая категория побеждает более низкую независимо от отдельных старших карт.'
            ],
            coachTip: 'Не путай обычный флеш со стрит-флешем: для второго нужны и одна масть, и последовательность.'
          },
          {
            id: 'rankings-best-five-kickers',
            topic: 'best five of seven',
            title: 'Лучшая пятёрка, кикеры и ничьи',
            sections: [
              'Из семи доступных карт выбирается лучшая комбинация ровно из пяти. Можно использовать две, одну или ни одной карманной карты.',
              'Кикеры решают только после совпадения категории и основных рангов комбинации.',
              'Если лучшие пять карт полностью одинаковы по силе, банк делится: шестая и седьмая карты не разрывают ничью.'
            ],
            coachTip: 'Запиши обе лучшие пятёрки рядом и сравнивай элементы оценки слева направо.'
          }
        ],
        examples: [
          {
            id: 'rankings-example-best-five',
            title: 'Играет доска',
            situation: 'Доска A♠ K♦ Q♣ J♥ 10♠, руки 2♣ 2♦ и 9♣ 9♦.',
            explanation: 'Обе лучшие пятёрки — общий стрит до туза. Карманные пары не входят в лучшую пятёрку, поэтому это ничья.'
          },
          {
            id: 'rankings-example-kicker',
            title: 'Кикер решает',
            situation: 'Доска K♣ 8♦ 4♠ 2♥ 2♣, руки A♠ K♦ и Q♠ K♥.',
            explanation: 'У обоих две пары: короли и двойки. Туз героя старше дамы соперника и выигрывает как кикер.'
          },
          {
            id: 'rankings-example-full-house',
            title: 'Два возможных фулл-хауса',
            situation: 'Из семи карт доступны K♠ K♥ K♦ 9♣ 9♦ 9♠ 2♣.',
            explanation: 'Лучшая пятёрка — K-K-K-9-9. Фулл-хаус с тройкой королей старше варианта с тройкой девяток.'
          }
        ],
        tasks: [
          question('rankings-task-category', 'сравнение рук', 'Что старше: flush или full house?',
            [choice('flush', 'Flush'), choice('full-house', 'Full house')], 'full-house', 'Full house расположен выше flush в стандартном порядке категорий.'),
          question('rankings-task-wheel', 'straight', 'A-2-3-4-5 — это…',
            [choice('high-card', 'High card'), choice('straight-five', 'Straight до пятёрки'), choice('straight-ace', 'Straight до туза')],
            'straight-five', 'Туз может быть младшей картой стрита A-2-3-4-5; старшая карта такого стрита — пятёрка.'),
          question('rankings-task-tie', 'ничьи', 'Общий борд уже содержит лучшую пятёрку для обоих. Что происходит?',
            [choice('hole-high', 'Побеждает старшая карманная карта'), choice('split', 'Банк делится'), choice('suit', 'Побеждает старшая масть')],
            'split', 'Шестая и седьмая карты не используются для разрыва полностью одинаковой лучшей пятёрки.')
        ],
        exam: {
          passingScore: 70,
          questions: [
            question('rankings-exam-high-pair', 'one pair', 'Что старше: high card или one pair?',
              [choice('high', 'High card'), choice('pair', 'One pair')], 'pair', 'Любая пара старше high card.'),
            question('rankings-exam-two-trips', 'three of a kind', 'Что старше: two pair или three of a kind?',
              [choice('two-pair', 'Two pair'), choice('trips', 'Three of a kind')], 'trips', 'Тройка старше двух пар.'),
            question('rankings-exam-straight-flush', 'flush', 'Что старше: straight или flush?',
              [choice('straight', 'Straight'), choice('flush', 'Flush')], 'flush', 'Flush старше straight.'),
            question('rankings-exam-full-quads', 'four of a kind', 'Что старше: full house или four of a kind?',
              [choice('full-house', 'Full house'), choice('quads', 'Four of a kind')], 'quads', 'Каре старше фулл-хауса.'),
            question('rankings-exam-top', 'straight flush', 'Какая из перечисленных категорий старше?',
              [choice('flush', 'Flush'), choice('quads', 'Four of a kind'), choice('straight-flush', 'Straight flush')],
              'straight-flush', 'Straight flush старше каре и обычного флеша.'),
            question('rankings-exam-best-five', 'best five of seven', 'Сколько карт входит в итоговую комбинацию?',
              [choice('5', 'Пять'), choice('7', 'Семь'), choice('2', 'Только две карманные')], '5', 'Всегда оценивается лучшая пятёрка из доступных семи карт.'),
            question('rankings-exam-kicker', 'кикеры', 'У игроков одинаковая пара. Что сравнивается дальше?',
              [choice('suit', 'Масть'), choice('kickers', 'Кикеры по старшинству'), choice('seat', 'Позиция за столом')],
              'kickers', 'После одинаковой пары сравниваются кикеры от старшего к младшему.'),
            question('rankings-exam-tie', 'ничьи', 'Лучшие пять карт одинаковы. Кто выигрывает?',
              [choice('split', 'Банк делится'), choice('button', 'Игрок на BTN'), choice('ace-hole', 'Игрок с тузом в руке')],
              'split', 'Полностью одинаковая лучшая пятёрка означает ничью.'),
            question('rankings-exam-flush-compare', 'flush', 'Как сравнивают два флеша?',
              [choice('top-cards', 'По старшим картам последовательно'), choice('suit', 'По масти'), choice('hole-count', 'По числу карманных карт')],
              'top-cards', 'Флеши сравниваются по старшей карте, затем по следующей и так далее.'),
            question('rankings-exam-full-house-compare', 'full house', 'Как сравнивают два фулл-хауса?',
              [choice('pair-first', 'Сначала по паре'), choice('trips-first', 'Сначала по тройке'), choice('suit', 'По масти')],
              'trips-first', 'Главный ранг фулл-хауса — ранг тройки; пара сравнивается только при равных тройках.')
          ]
        }
      },
      {
        id: 'table-positions',
        order: 3,
        title: 'Позиции за покерным столом',
        description: 'Порядок действий, зоны стола, IP/OOP и стартовые руки по позициям.',
        topics: [
          'ранняя позиция', 'средняя позиция', 'поздняя позиция',
          'блайнды', 'IP', 'OOP', 'стартовые руки по позициям'
        ],
        table: {
          title: '6-max стол',
          instruction: 'Выбери место, чтобы увидеть его роль и примеры стартовых рук.',
          positions: [
            {
              id: 'UTG',
              group: 'early',
              groupLabel: 'Ранняя позиция',
              description: 'UTG действует первым префлоп и почти без информации, поэтому открывает самый сильный и узкий диапазон.',
              postflop: 'Часто OOP против поздних позиций.',
              exampleHands: ['AA', 'KK', 'QQ', 'AKs', 'AQs']
            },
            {
              id: 'HJ',
              group: 'middle',
              groupLabel: 'Средняя позиция',
              description: 'HJ получает больше информации, чем UTG, но за ним остаются CO, BTN и блайнды, поэтому диапазон всё ещё дисциплинирован.',
              postflop: 'Может быть IP против блайндов и OOP против CO/BTN.',
              exampleHands: ['JJ+', 'AQs+', 'AKo', 'KQs', 'AJs', 'TT']
            },
            {
              id: 'CO',
              group: 'late',
              groupLabel: 'Поздняя позиция',
              description: 'CO находится справа от BTN и может открываться шире, особенно когда BTN и блайнды играют тайтово.',
              postflop: 'Часто IP против блайндов, но OOP против BTN.',
              exampleHands: ['99+', 'ATs+', 'KJs+', 'QJs', 'AJo+', 'KQo', 'A5s']
            },
            {
              id: 'BTN',
              group: 'late',
              groupLabel: 'Поздняя позиция',
              description: 'BTN — самая выгодная позиция: после флопа он обычно действует последним и лучше реализует equity широкого диапазона.',
              postflop: 'Обычно IP против всех оставшихся соперников.',
              exampleHands: ['77+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'ATo+', 'KJo+', 'T9s']
            },
            {
              id: 'SB',
              group: 'blinds',
              groupLabel: 'Блайнды',
              description: 'SB уже вложил половину большого блайнда, но после флопа почти всегда действует первым, поэтому широкий пассивный call опасен.',
              postflop: 'Почти всегда OOP.',
              exampleHands: ['88+', 'ATs+', 'KQs', 'AQo+', 'A5s']
            },
            {
              id: 'BB',
              group: 'blinds',
              groupLabel: 'Блайнды',
              description: 'BB закрывает префлоп-торги и получает лучшую цену на call, но защита зависит от позиции открывающего и размера рейза.',
              postflop: 'Обычно OOP против открывающего.',
              exampleHands: ['Любая пара', 'Axs', 'KTs+', 'QTs+', 'JTs', 'T9s', 'KQo']
            }
          ]
        },
        lessons: [
          {
            id: 'positions-order-zones',
            topic: 'ранняя позиция',
            title: 'Порядок действий и зоны стола',
            sections: [
              'Позиция — место относительно кнопки дилера. Префлоп первым действует UTG, затем HJ, CO, BTN, SB и BB.',
              'UTG относится к ранней позиции, HJ — к средней, CO и BTN — к поздней, а SB и BB образуют блайнды.',
              'Чем позже решение, тем больше действий соперников уже известно и тем шире обычно может быть диапазон.'
            ],
            coachTip: 'Перед оценкой карт сначала назови свою позицию и сколько игроков ещё будут действовать после тебя.'
          },
          {
            id: 'positions-late-advantage',
            topic: 'поздняя позиция',
            title: 'Почему CO и BTN играют шире',
            sections: [
              'CO и BTN чаще забирают блайнды без борьбы и реже получают неожиданный рейз от игроков позади.',
              'BTN после флопа обычно действует последним, поэтому может точнее выбирать value bet, bluff и контроль банка.',
              'Одна и та же пограничная рука может быть fold из UTG и прибыльным open с BTN.'
            ],
            coachTip: 'Широкий диапазон поздней позиции — результат информации и инициативы, а не разрешение играть любые две карты.'
          },
          {
            id: 'positions-ip-oop',
            topic: 'IP',
            title: 'IP и OOP после флопа',
            sections: [
              'IP (in position) означает действовать после соперника на постфлопе. OOP (out of position) — действовать раньше.',
              'IP лучше контролирует размер банка, реализует equity и собирает информацию. OOP чаще выбирает осторожные размеры и checks.',
              'Позиция относительна: CO будет IP против BB, но OOP против BTN.'
            ],
            coachTip: 'Не путай название места и относительную позицию: всегда сравнивай место героя с конкретным соперником.'
          },
          {
            id: 'positions-starting-hands',
            topic: 'стартовые руки по позициям',
            title: 'Примеры стартовых рук по позициям',
            sections: [
              'Из UTG приоритет получают сильные пары, большие suited broadway и AK: за героем ещё много игроков.',
              'С HJ и CO добавляются средние пары, suited aces и связные broadway. BTN может открывать ещё шире.',
              'BB защищает диапазон против конкретного открытия: против BTN шире, чем против сильного UTG.'
            ],
            coachTip: 'Примеры — учебные ориентиры, а не абсолютные GTO-чарты: стек, размер рейза и тип соперника меняют решение.'
          }
        ],
        examples: [
          {
            id: 'positions-example-a5s',
            title: 'A5s из UTG и BTN',
            situation: 'До героя все сделали fold; у героя A♠ 5♠.',
            explanation: 'Из UTG рука погранична и часто выбрасывается, а с BTN может открываться благодаря позиции, fold equity и играбельности.'
          },
          {
            id: 'positions-example-bb-defense',
            title: 'Защита BB зависит от открывающего',
            situation: 'Герой в BB с KQo получает одинаковый рейз от UTG или BTN.',
            explanation: 'Против узкого UTG диапазона нужна осторожность; против широкого BTN KQo значительно чаще продолжает.'
          },
          {
            id: 'positions-example-relative',
            title: 'Позиция относительна',
            situation: 'CO и BTN увидели флоп против BB.',
            explanation: 'Оба действуют после BB, но если CO и BTN остались вместе, BTN действует после CO и имеет позиционное преимущество.'
          }
        ],
        tasks: [
          question('positions-task-latest', 'поздняя позиция', 'Какая позиция обычно действует последней после флопа?',
            [choice('utg', 'UTG'), choice('btn', 'BTN'), choice('sb', 'SB')], 'btn',
            'BTN обычно действует последним после флопа и получает максимум информации.'),
          question('positions-task-ip', 'IP', 'Герой на CO играет против BB. Кто обычно IP после флопа?',
            [choice('co', 'CO'), choice('bb', 'BB'), choice('neither', 'Никто')], 'co',
            'CO находится после BB по постфлоп-порядку и поэтому играет IP.'),
          question('positions-task-range', 'стартовые руки по позициям', 'Где одна и та же пограничная рука обычно открывается шире?',
            [choice('utg', 'UTG'), choice('btn', 'BTN')], 'btn',
            'BTN использует информацию, инициативу и постфлоп-позицию, поэтому его open-диапазон шире.')
        ],
        exam: {
          passingScore: 70,
          questions: [
            question('positions-exam-first', 'ранняя позиция', 'Кто действует первым префлоп за 6-max столом?',
              [choice('utg', 'UTG'), choice('btn', 'BTN'), choice('bb', 'BB')], 'utg',
              'UTG первым принимает добровольное решение префлоп.'),
            question('positions-exam-middle', 'средняя позиция', 'Какая позиция относится к средней в этом курсе?',
              [choice('hj', 'HJ'), choice('btn', 'BTN'), choice('sb', 'SB')], 'hj',
              'HJ находится между ранним UTG и поздними CO/BTN.'),
            question('positions-exam-late', 'поздняя позиция', 'Какая пара относится к поздним позициям?',
              [choice('co-btn', 'CO и BTN'), choice('utg-hj', 'UTG и HJ'), choice('sb-bb', 'SB и BB')], 'co-btn',
              'CO и BTN — поздние позиции.'),
            question('positions-exam-blinds', 'блайнды', 'Какие позиции вносят обязательные blinds?',
              [choice('sb-bb', 'SB и BB'), choice('co-btn', 'CO и BTN'), choice('utg-hj', 'UTG и HJ')], 'sb-bb',
              'Small blind и big blind вносят обязательные ставки.'),
            question('positions-exam-ip', 'IP', 'Что означает IP?',
              [choice('after', 'Действовать после соперника'), choice('before', 'Действовать до соперника'), choice('allin', 'Быть all-in')], 'after',
              'In position означает действовать после соперника на постфлопе.'),
            question('positions-exam-oop', 'OOP', 'Герой в SB против BTN. Герой обычно…',
              [choice('ip', 'IP'), choice('oop', 'OOP'), choice('button', 'На BTN')], 'oop',
              'SB действует раньше BTN после флопа и поэтому находится OOP.'),
            question('positions-exam-relative', 'IP', 'CO играет против BB без BTN. Кто IP?',
              [choice('co', 'CO'), choice('bb', 'BB')], 'co',
              'CO действует после BB и находится IP.'),
            question('positions-exam-width', 'стартовые руки по позициям', 'Чей open-диапазон обычно шире?',
              [choice('utg', 'UTG'), choice('btn', 'BTN')], 'btn',
              'BTN действует поздно и обычно открывает шире UTG.'),
            question('positions-exam-bb-range', 'стартовые руки по позициям', 'Против какого открытия BB обычно защищается шире?',
              [choice('utg', 'UTG'), choice('btn', 'BTN')], 'btn',
              'BTN открывает шире, поэтому BB может защищать больше рук.'),
            question('positions-exam-information', 'поздняя позиция', 'Главное практическое преимущество поздней позиции?',
              [choice('information', 'Больше информации до решения'), choice('extra-card', 'Дополнительная карта'), choice('higher-suit', 'Старшая масть')], 'information',
              'Поздняя позиция видит действия соперников и чаще действует последней после флопа.')
          ]
        }
      }
    ],
    upcomingModules: [
      {
        id: 'starting-hands',
        order: 4,
        title: 'Стартовые руки',
        description: 'Диапазоны входа в банк из разных позиций.',
        requires: 'table-positions'
      }
    ]
  };

  root.POKERPILOT_COURSE = course;
  if (typeof module === 'object' && module.exports) module.exports = course;
})(typeof window !== 'undefined' ? window : globalThis);
