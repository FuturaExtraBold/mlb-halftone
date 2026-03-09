import { useApp } from "../context/AppContext";
import { teams } from "../teams";

export function Teams() {
  const { setHoveredTeam } = useApp();

  return (
    <div className="teams-panel">
      {teams.map((team) => (
        <div key={team.name} className="team-card">
          <img src={team.logo} className="team-card-logo" alt={team.name} />
          <ol className="team-card-roster">
            {team.players.map((player, i) => (
              <li
                key={player.name}
                className="team-card-player"
                onMouseEnter={() =>
                  setHoveredTeam({
                    ...team,
                    playerImage: player.playerImage || team.playerImage,
                  })
                }
              >
                {i + 1}. {player.name} {player.position}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
