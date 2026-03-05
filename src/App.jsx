import gsap from "gsap";
import { useEffect, useRef } from "react";
import { ControlBar } from "./components/ControlBar";
import { HalftoneImage } from "./components/HalftoneImage";
import { AppProvider, useApp } from "./context/AppContext";
import { teams } from "./teams";

function Main() {
  const { hoveredTeam, setHoveredTeam } = useApp();
  const mainRef = useRef(null);

  const getBackground = () => {
    if (hoveredTeam) {
      return hoveredTeam.color;
    }
    return "#111";
  };

  useEffect(() => {
    if (mainRef.current) {
      gsap.to(mainRef.current, {
        backgroundColor: getBackground(),
        duration: 0.5,
        ease: "power2.out",
      });
    }
  }, [hoveredTeam]);

  return (
    <main ref={mainRef} style={{ background: getBackground() }}>
      <HalftoneImage />
      <div className="team-list">
        {teams.map((team) => (
          <button
            key={team.name}
            className="team-button"
            onMouseEnter={() => setHoveredTeam(team)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            {team.name}
          </button>
        ))}
      </div>
      <ControlBar />
    </main>
  );
}

function App() {
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
}

export default App;
