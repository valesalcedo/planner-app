import { BottomNav } from './components/BottomNav';
import { CalendarScreen } from './screens/calendar/CalendarScreen';
import { FocusScreen } from './screens/focus/FocusScreen';
import { ScheduleScreen } from './screens/schedule/ScheduleScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { ShopScreen } from './screens/shop/ShopScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { TaskForm } from './screens/task-form/TaskForm';
import { TodayScreen } from './screens/today/TodayScreen';
import { useUI } from './store/useUI';

const TABS = {
  hoy: TodayScreen,
  calendario: CalendarScreen,
  foco: FocusScreen,
  stats: StatsScreen,
  tienda: ShopScreen,
};

export function App() {
  const tab = useUI((s) => s.tab);
  const page = useUI((s) => s.page);
  const taskForm = useUI((s) => s.taskForm);
  const toast = useUI((s) => s.toast);

  const Screen = TABS[tab];

  return (
    <>
      <main>
        {page === 'ajustes' ? <SettingsScreen /> : page === 'horario' ? <ScheduleScreen /> : <Screen />}
      </main>
      {page === null && <BottomNav />}
      {taskForm && <TaskForm key={taskForm.taskId ?? 'new'} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
