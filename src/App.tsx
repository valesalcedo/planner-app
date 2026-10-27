import { BottomNav } from './components/BottomNav';
import { useAchievementWatcher } from './hooks/useAchievements';
import { AchievementsScreen } from './screens/achievements/AchievementsScreen';
import { CalendarScreen } from './screens/calendar/CalendarScreen';
import { FocusScreen } from './screens/focus/FocusScreen';
import { MenuScreen } from './screens/menu/MenuScreen';
import { ScheduleScreen } from './screens/schedule/ScheduleScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { ShopScreen } from './screens/shop/ShopScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { TaskForm } from './screens/task-form/TaskForm';
import { TimeLogForm } from './screens/time-log/TimeLogForm';
import { TodayScreen } from './screens/today/TodayScreen';
import { TrashScreen } from './screens/trash/TrashScreen';
import { useUI } from './store/useUI';

const TABS = {
  hoy: TodayScreen,
  calendario: CalendarScreen,
  foco: FocusScreen,
  stats: StatsScreen,
  menu: MenuScreen,
  tienda: ShopScreen,
  logros: AchievementsScreen,
};

export function App() {
  const tab = useUI((s) => s.tab);
  const page = useUI((s) => s.page);
  const taskForm = useUI((s) => s.taskForm);
  const timeLog = useUI((s) => s.timeLog);
  const toast = useUI((s) => s.toast);
  const toastAction = useUI((s) => s.toastAction);
  const hideToast = useUI((s) => s.hideToast);
  useAchievementWatcher();

  const Screen = TABS[tab];

  return (
    <>
      <main>
        {page === 'ajustes' ? (
          <SettingsScreen />
        ) : page === 'horario' ? (
          <ScheduleScreen />
        ) : page === 'papelera' ? (
          <TrashScreen />
        ) : (
          <Screen />
        )}
      </main>
      {page === null && <BottomNav />}
      {taskForm && <TaskForm key={taskForm.taskId ?? 'new'} />}
      {timeLog && <TimeLogForm key={timeLog.taskId ?? 'any'} />}
      {toast && (
        <div className={toastAction ? 'toast toast--action' : 'toast'} role="status">
          <span>{toast}</span>
          {toastAction && (
            <button
              type="button"
              className="toast__btn"
              onClick={() => {
                toastAction.run();
                hideToast();
              }}
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
