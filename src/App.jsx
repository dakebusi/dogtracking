import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Crown, GripVertical, Medal, Route, Sparkles, Trophy } from 'lucide-react';

const currentDate = new Date('2026-06-03T12:00:00');
const dayMs = 24 * 60 * 60 * 1000;
const leaderboardConfigs = [
  { id: 'weekly', title: 'Weekly leaderboard', detail: 'Last 7 days', metricKey: 'weeklyKm' },
  { id: 'monthly', title: 'Monthly leaderboard', detail: 'June 2026', metricKey: 'monthlyKm' },
  { id: 'yearly', title: 'Yearly leaderboard', detail: 'Year to date', metricKey: 'yearlyKm' },
  { id: 'total', title: 'Total leaderboard', detail: 'All time', metricKey: 'totalKm' }
];
const dashboardCardOrder = ['weekly', 'monthly', 'yearly', 'total', 'timeframes', 'trend'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isSameDay(date) {
  return date.toDateString() === currentDate.toDateString();
}

function isWithinDays(date, days) {
  return currentDate.getTime() - date.getTime() < days * dayMs && date <= currentDate;
}

function isSameMonth(date) {
  return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
}

function isSameYear(date) {
  return date.getFullYear() === currentDate.getFullYear();
}

function sumKm(runs) {
  return runs.reduce((total, run) => total + run.km, 0);
}

function formatKm(value) {
  return `${value.toFixed(1)} km`;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

function getMonthKey(date) {
  return date.toISOString().slice(0, 7);
}

function parseCsvRows(csv) {
  const [headerLine, ...lines] = csv.trim().split('\n');
  const headers = headerLine.split(',');

  return lines.map((line) => {
    const values = line.split(',');
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] }), {});
  });
}

function combineDogsAndRuns(dogRows, runRows) {
  const dogsById = dogRows.reduce((dogMap, row) => {
    const dogId = Number(row.dog_id);

    return dogMap.set(dogId, {
      id: dogId,
      name: row.name,
      breed: row.breed,
      color: row.color,
      accent: row.accent,
      imagePath: row.image_path,
      runs: []
    });
  }, new Map());

  runRows.forEach((row) => {
    const dog = dogsById.get(Number(row.dog_id));

    if (dog) {
      dog.runs.push({
        date: row.date,
        km: Number(row.km)
      });
    }
  });

  return Array.from(dogsById.values());
}

function calculateDogStats(dogs) {
  return dogs
    .map((dog) => {
    const datedRuns = dog.runs.map((run) => ({ ...run, parsedDate: new Date(`${run.date}T12:00:00`) }));

    return {
      ...dog,
      totalKm: sumKm(datedRuns),
      totalRuns: datedRuns.length,
      dailyKm: sumKm(datedRuns.filter((run) => isSameDay(run.parsedDate))),
      weeklyKm: sumKm(datedRuns.filter((run) => isWithinDays(run.parsedDate, 7))),
      monthlyKm: sumKm(datedRuns.filter((run) => isSameMonth(run.parsedDate))),
      yearlyKm: sumKm(datedRuns.filter((run) => isSameYear(run.parsedDate))),
      latestRun: datedRuns.sort((a, b) => b.parsedDate - a.parsedDate)[0]
    };
  })
  .sort((a, b) => b.totalKm - a.totalKm)
  .map((dog, index) => ({ ...dog, rank: index + 1 }));
}

function calculateTotals(dogStats) {
  return dogStats.reduce(
    (summary, dog) => ({
      km: summary.km + dog.totalKm,
      runs: summary.runs + dog.totalRuns,
      daily: summary.daily + dog.dailyKm,
      weekly: summary.weekly + dog.weeklyKm,
      monthly: summary.monthly + dog.monthlyKm,
      yearly: summary.yearly + dog.yearlyKm
    }),
    { km: 0, runs: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0 }
  );
}

function getAvailableMonths(dogs) {
  const monthKeys = new Set();

  dogs.forEach((dog) => {
    dog.runs.forEach((run) => {
      monthKeys.add(run.date.slice(0, 7));
    });
  });

  return [...monthKeys].sort((a, b) => b.localeCompare(a));
}

function getAvailableYears(months) {
  return [...new Set(months.map((month) => month.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
}

function applySelectedMonthStats(dogStats, selectedMonth) {
  return dogStats.map((dog) => ({
    ...dog,
    selectedMonthKm: sumKm(dog.runs.filter((run) => run.date.startsWith(selectedMonth)))
  }));
}

function calculateDailySeries(dogs) {
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() - (29 - index));
    return formatDateKey(date);
  });

  return dogs.map((dog) => {
    const kmByDate = dog.runs.reduce((dailyTotals, run) => {
      dailyTotals[run.date] = (dailyTotals[run.date] ?? 0) + run.km;
      return dailyTotals;
    }, {});

    return {
      id: dog.id,
      name: dog.name,
      color: dog.color,
      points: days.map((date) => ({
        date,
        km: kmByDate[date] ?? 0
      }))
    };
  });
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">
        <Icon size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function MonthPicker({ availableMonths, selectedMonth, onMonthChange }) {
  const availableMonthSet = new Set(availableMonths);
  const availableYears = getAvailableYears(availableMonths);
  const [selectedYear, setSelectedYear] = useState(selectedMonth.slice(0, 4));
  const currentYearIndex = availableYears.indexOf(selectedYear);
  const canGoPreviousYear = currentYearIndex < availableYears.length - 1;
  const canGoNextYear = currentYearIndex > 0;

  function changeYear(direction) {
    const nextYear = availableYears[currentYearIndex + direction];

    if (nextYear) {
      setSelectedYear(nextYear);
    }
  }

  return (
    <div className="month-picker" onDragStart={(event) => event.stopPropagation()}>
      <div className="month-picker-header">
        <button type="button" onClick={() => changeYear(1)} disabled={!canGoPreviousYear}>
          ‹
        </button>
        <strong>{selectedYear}</strong>
        <button type="button" onClick={() => changeYear(-1)} disabled={!canGoNextYear}>
          ›
        </button>
      </div>

      <div className="month-grid">
        {monthNames.map((monthName, index) => {
          const monthKey = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
          const isAvailable = availableMonthSet.has(monthKey);
          const isSelected = selectedMonth === monthKey;

          return (
            <button
              type="button"
              key={monthKey}
              className={isSelected ? 'selected' : ''}
              disabled={!isAvailable}
              onClick={() => onMonthChange(monthKey)}
            >
              {monthName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyLineChart({ series, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hiddenDogIds, setHiddenDogIds] = useState([]);
  const chartWidth = 900;
  const chartHeight = 320;
  const padding = { top: 26, right: 28, bottom: 42, left: 46 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const visibleSeries = series.filter((dog) => !hiddenDogIds.includes(dog.id));
  const maxKm = Math.max(...visibleSeries.flatMap((dog) => dog.points.map((point) => point.km)), 1);
  const days = series[0]?.points ?? [];
  const xForIndex = (index) => padding.left + (index / Math.max(days.length - 1, 1)) * plotWidth;
  const yForKm = (km) => padding.top + plotHeight - (km / maxKm) * plotHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  function toggleDogVisibility(dogId) {
    setHiddenDogIds((currentIds) =>
      currentIds.includes(dogId) ? currentIds.filter((currentId) => currentId !== dogId) : [...currentIds, dogId]
    );
    setHoveredPoint(null);
  }

  return (
    <section className="panel chart-panel dashboard-card-wide" draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}>
      <div className="section-heading">
        <div>
          <p>Trend</p>
          <h2>Daily distance, last 30 days</h2>
        </div>
        <Activity size={24} />
      </div>

      <div className="chart-legend">
        {series.map((dog) => (
          <button
            type="button"
            key={dog.id}
            className={hiddenDogIds.includes(dog.id) ? 'inactive' : ''}
            onClick={() => toggleDogVisibility(dog.id)}
            onDragStart={(event) => event.stopPropagation()}
          >
            <i style={{ background: dog.color }} />
            {dog.name}
          </button>
        ))}
      </div>

      <div className="chart-scroll">
        <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Line chart showing each dog's daily total for the last 30 days">
          {gridLines.map((line) => {
            const y = padding.top + plotHeight - line * plotHeight;
            const value = maxKm * line;

            return (
              <g key={line}>
                <line className="chart-grid-line" x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} />
                <text className="chart-axis-label" x={padding.left - 12} y={y + 4} textAnchor="end">
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}

          <text className="chart-axis-label chart-y-label" x={14} y={padding.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90, 14, ${padding.top + plotHeight / 2})`}>
            km
          </text>

          {days.map((day, index) => {
            if (index % 5 !== 0 && index !== days.length - 1) {
              return null;
            }

            return (
              <text className="chart-axis-label" key={day.date} x={xForIndex(index)} y={chartHeight - 12} textAnchor="middle">
                {day.date.slice(5)}
              </text>
            );
          })}

          {visibleSeries.map((dog) => {
            const path = dog.points
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForIndex(index)} ${yForKm(point.km)}`)
              .join(' ');

            return (
              <g key={dog.id}>
                <path className="chart-line" d={path} stroke={dog.color} />
                {dog.points.map((point, index) =>
                  point.km > 0 ? (
                    <circle
                      className="chart-point"
                      key={`${dog.id}-${point.date}`}
                      cx={xForIndex(index)}
                      cy={yForKm(point.km)}
                      r="5"
                      fill={dog.color}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          x: xForIndex(index),
                          y: yForKm(point.km),
                          dogName: dog.name,
                          date: point.date,
                          km: point.km,
                          color: dog.color
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ) : null
                )}
              </g>
            );
          })}

          {hoveredPoint ? (
            <g className="chart-tooltip" transform={`translate(${Math.min(hoveredPoint.x + 12, chartWidth - 172)} ${Math.max(hoveredPoint.y - 54, 12)})`}>
              <rect width="160" height="48" rx="12" fill="#0f172a" />
              <circle cx="16" cy="17" r="5" fill={hoveredPoint.color} />
              <text x="28" y="20">
                {hoveredPoint.dogName}
              </text>
              <text x="16" y="37">
                {hoveredPoint.date} · {formatKm(hoveredPoint.km)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
    </section>
  );
}

function Leaderboard({ title, detail, dogs, metricKey, headerControl, children, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const rankedDogs = [...dogs]
    .sort((a, b) => b[metricKey] - a[metricKey])
    .map((dog, index) => ({ ...dog, periodRank: index + 1 }));
  const maxKm = Math.max(...rankedDogs.map((dog) => dog[metricKey]), 0);

  return (
    <section
      className="leaderboard-section leaderboard-card"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="leaderboard-title">
        <div>
          <span>{detail}</span>
          <h3>{title}</h3>
        </div>
        <div className="leaderboard-actions">
          {headerControl}
          <Medal size={20} />
          <GripVertical size={20} />
        </div>
      </div>
      {children}

      <div className="leaderboard">
        {rankedDogs.map((dog) => (
          <article className="leader-row" key={`${metricKey}-${dog.id}`}>
            <div className="rank" style={{ background: dog.accent, color: dog.color }}>
              #{dog.periodRank}
            </div>
            <div className="leader-avatar" style={{ '--dog-color': dog.color }}>
              <img src={dog.imagePath} alt={`${dog.name} the ${dog.breed}`} />
            </div>
            <div className="dog-meta">
              <strong>{dog.name}</strong>
            </div>
            <div className="distance-bar" aria-hidden="true">
              <span style={{ width: `${maxKm ? (dog[metricKey] / maxKm) * 100 : 0}%`, background: dog.color }} />
            </div>
            <strong className="km-value">{formatKm(dog[metricKey])}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [dogs, setDogs] = useState([]);
  const [dataStatus, setDataStatus] = useState('loading');
  const [dashboardOrder, setDashboardOrder] = useState(dashboardCardOrder);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(currentDate));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetch(`${import.meta.env.BASE_URL}dogs.csv`), fetch(`${import.meta.env.BASE_URL}dog-runs.csv`)])
      .then((responses) => {
        if (responses.some((response) => !response.ok)) {
          throw new Error('Unable to load dog CSV data');
        }

        return Promise.all(responses.map((response) => response.text()));
      })
      .then(([dogsCsv, runsCsv]) => {
        setDogs(combineDogsAndRuns(parseCsvRows(dogsCsv), parseCsvRows(runsCsv)));
        setDataStatus('ready');
      })
      .catch(() => {
        setDataStatus('error');
      });
  }, []);

  const dogStats = useMemo(() => calculateDogStats(dogs), [dogs]);
  const availableMonths = useMemo(() => getAvailableMonths(dogs), [dogs]);
  const leaderboardStats = useMemo(() => applySelectedMonthStats(dogStats, selectedMonth), [dogStats, selectedMonth]);
  const totals = useMemo(() => calculateTotals(dogStats), [dogStats]);
  const dailySeries = useMemo(() => calculateDailySeries(dogs), [dogs]);
  const topDog = dogStats[0];

  function moveDashboardCard(targetCardId) {
    if (!draggedCardId || draggedCardId === targetCardId) {
      return;
    }

    setDashboardOrder((currentOrder) => {
      const nextOrder = currentOrder.filter((cardId) => cardId !== draggedCardId);
      const targetIndex = nextOrder.indexOf(targetCardId);
      nextOrder.splice(targetIndex, 0, draggedCardId);
      return nextOrder;
    });
    setDraggedCardId(null);
  }

  function getDragHandlers(cardId) {
    return {
      onDragStart: () => setDraggedCardId(cardId),
      onDragOver: (event) => event.preventDefault(),
      onDrop: () => moveDashboardCard(cardId),
      onDragEnd: () => setDraggedCardId(null)
    };
  }

  function renderDashboardCard(cardId) {
    const leaderboard = leaderboardConfigs.find((config) => config.id === cardId);

    if (leaderboard) {
      const isMonthlyLeaderboard = leaderboard.id === 'monthly';

      return (
        <Leaderboard
          key={leaderboard.id}
          title={leaderboard.title}
          detail={isMonthlyLeaderboard ? formatMonthLabel(selectedMonth) : leaderboard.detail}
          dogs={leaderboardStats}
          metricKey={isMonthlyLeaderboard ? 'selectedMonthKm' : leaderboard.metricKey}
          headerControl={
            isMonthlyLeaderboard ? (
              <button
                type="button"
                className="calendar-toggle"
                aria-label="Toggle month selector"
                aria-expanded={isMonthPickerOpen}
                onClick={() => setIsMonthPickerOpen((isOpen) => !isOpen)}
                onDragStart={(event) => event.stopPropagation()}
              >
                <CalendarDays size={18} />
              </button>
            ) : null
          }
          {...getDragHandlers(leaderboard.id)}
        >
          {isMonthlyLeaderboard && isMonthPickerOpen ? (
            <MonthPicker availableMonths={availableMonths} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          ) : null}
        </Leaderboard>
      );
    }

    if (cardId === 'trend') {
      return <DailyLineChart key="trend" series={dailySeries} {...getDragHandlers('trend')} />;
    }

    return (
      <div key="timeframes" className="panel split-panel dashboard-card-wide" draggable {...getDragHandlers('timeframes')}>
        <div className="section-heading">
          <div>
            <p>Timeframes</p>
            <h2>Daily, weekly, monthly, yearly</h2>
          </div>
          <CalendarDays size={24} />
        </div>

        <div className="timeframe-list">
          {dogStats.map((dog) => (
            <article className="timeframe-card" key={dog.id} style={{ '--dog-color': dog.color }}>
              <div className="dog-avatar">
                <img src={dog.imagePath} alt={`${dog.name} the ${dog.breed}`} />
              </div>
              <div className="timeframe-content">
                <div className="dog-card-header">
                  <div>
                    <strong>{dog.name}</strong>
                    <span>{dog.totalRuns} runs</span>
                  </div>
                  <span className="latest-run">Last: {dog.latestRun.date}</span>
                </div>
                <div className="metric-columns">
                  <div>
                    <span>Today</span>
                    <strong>{formatKm(dog.dailyKm)}</strong>
                  </div>
                  <div>
                    <span>Week</span>
                    <strong>{formatKm(dog.weeklyKm)}</strong>
                  </div>
                  <div>
                    <span>Month</span>
                    <strong>{formatKm(dog.monthlyKm)}</strong>
                  </div>
                  <div>
                    <span>Year</span>
                    <strong>{formatKm(dog.yearlyKm)}</strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (dataStatus === 'loading') {
    return (
      <main className="app-shell">
        <section className="status-card">Loading dog run stats...</section>
      </main>
    );
  }

  if (dataStatus === 'error' || !topDog) {
    return (
      <main className="app-shell">
        <section className="status-card">Could not load dog stats from the CSV files.</section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-content">
          <h1>La feina dels nostres peluts</h1>
          <p>Track distance, activity streaks and rankings for your running pack with daily, weekly, monthly and yearly insights.</p>
        </div>
        <div className="hero-highlight">
          <div className="leader-hero-avatar">
            <img src={topDog.imagePath} alt={`${topDog.name} the ${topDog.breed}`} />
          </div>
          <span className="leader-label">
            <Crown size={18} />
            Current leader
          </span>
          <strong>{topDog.name}</strong>
          <p>{formatKm(topDog.totalKm)} total distance</p>
        </div>
      </section>

      <section className="stats-grid" aria-label="Pack summary">
        <StatCard icon={Route} label="Total distance" value={formatKm(totals.km)} detail="Across all dogs" />
        <StatCard icon={Activity} label="Runs logged" value={totals.runs} detail="Sample activities" />
        <StatCard icon={CalendarDays} label="This week" value={formatKm(totals.weekly)} detail="Last 7 days" />
        <StatCard icon={Trophy} label="This month" value={formatKm(totals.monthly)} detail="June 2026" />
        <StatCard icon={CalendarDays} label="This year" value={formatKm(totals.yearly)} detail="Year to date" />
      </section>

      <section className="dashboard-card-grid">{dashboardOrder.map((cardId) => renderDashboardCard(cardId))}</section>
    </main>
  );
}

export default App;
