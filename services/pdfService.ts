import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Match, Squad, Player, TrainingSession, AttendanceRecord, AttendanceStatus } from '../types';
import { CLUB_NAME } from '../constants';

// Removed getDataUrl function as logo is no longer needed

const addHeader = async (doc: jsPDF, title: string, subtitle: string) => {
    const primaryColor = [16, 185, 129]; // Emerald 500
    const darkColor = [30, 41, 59]; // Slate 800

    // No Logo logic here anymore as requested
    
    // -- Header --
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(CLUB_NAME, 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 28);

    // -- Title --
    doc.setFontSize(18);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(title.toUpperCase(), 14, 45);

    return 55; // Return Y position for next element
}

const addFooter = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado automaticamente por ${CLUB_NAME} Manager`, 14, pageHeight - 10);
}

// 1. CONVOCATORIA PDF
export const generateConvocationPDF = async (
  match: Match, 
  squad: Squad, 
  players: Player[]
) => {
  const doc = new jsPDF();
  const startY = await addHeader(doc, `CONVOCATÓRIA - ${squad.name}`, "Gestão de Equipas");

  // -- Match Details --
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  let detailsY = startY;
  doc.setFont("helvetica", "bold");
  doc.text("Adversário:", 14, detailsY);
  doc.setFont("helvetica", "normal");
  doc.text(match.opponent, 40, detailsY);

  doc.setFont("helvetica", "bold");
  doc.text("Data/Hora:", 14, detailsY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(`${match.date} às ${match.time}`, 40, detailsY + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Local:", 14, detailsY + 12);
  doc.setFont("helvetica", "normal");
  doc.text(match.location, 40, detailsY + 12);

  if (match.playerKit || match.goalkeeperKit) {
     detailsY += 6;
     doc.setFont("helvetica", "bold");
     doc.text("Equipamentos:", 14, detailsY + 12);
     doc.setFont("helvetica", "normal");
     let kitText = "";
     if(match.playerKit) kitText += `Jogadores: ${match.playerKit} `;
     if(match.goalkeeperKit) kitText += `| GR: ${match.goalkeeperKit}`;
     doc.text(kitText, 45, detailsY + 12);
     detailsY += 6;
  }

  // -- Players Table --
  const sortedPlayers = [...players].sort((a, b) => Number(a.jerseyNumber) - Number(b.jerseyNumber));
  const tableData = sortedPlayers.map(p => [p.jerseyNumber, p.name, p.jerseyName || '-']);

  autoTable(doc, {
    startY: detailsY + 20,
    head: [['#', 'Nome Completo', 'Nome Camisola']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: [240, 253, 244] }
  });
  
  // -- Notes --
  if (match.notes) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES:", 14, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(match.notes, 180);
    doc.text(splitNotes, 14, finalY + 5);
  }

  addFooter(doc);
  doc.save(`Convocatoria_${squad.name}_vs_${match.opponent.replace(/\s+/g, '_')}.pdf`);
};

// 2. FICHA DE JOGO PDF (MATCH SHEET - Minutes & Obs)
export const generateMatchSheetPDF = async (
    match: Match,
    squad: Squad,
    players: Player[]
) => {
    const doc = new jsPDF();
    const startY = await addHeader(doc, `FICHA DE JOGO - ${squad.name}`, "Relatório de Jogo");

    // -- Match Details --
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    let detailsY = startY;

    doc.setFont("helvetica", "bold"); doc.text("Adversário:", 14, detailsY);
    doc.setFont("helvetica", "normal"); doc.text(match.opponent, 40, detailsY);
    
    doc.setFont("helvetica", "bold"); doc.text("Data:", 14, detailsY + 6);
    doc.setFont("helvetica", "normal"); doc.text(`${match.date} ${match.time}`, 40, detailsY + 6);

    // -- Stats Table --
    // Filter only players that were convoked
    const matchPlayers = players.filter(p => match.convokedIds.includes(p.id))
        .sort((a,b) => Number(a.jerseyNumber) - Number(b.jerseyNumber));
    
    const tableData = matchPlayers.map(p => {
        const minutes = match.gameData?.playerMinutes?.[p.id] || 0;
        const isStarter = match.gameData?.startingXI?.includes(p.id) || match.gameData?.starters?.includes(p.id) || false;
        
        // Count goals from events
        const goals = match.gameData?.events?.filter(e => e.type === 'GOAL' && e.playerId === p.id).length || 0;
        const cards = match.gameData?.events?.filter(e => (e.type === 'CARD_YELLOW' || e.type === 'CARD_RED') && e.playerId === p.id).length || 0;

        return [
            p.jerseyNumber,
            p.name,
            isStarter ? 'Titular' : 'Sup',
            minutes + "'",
            goals > 0 ? goals.toString() : '-',
            cards > 0 ? cards.toString() : '-'
        ];
    });

    autoTable(doc, {
        startY: detailsY + 15,
        head: [['#', 'Nome', 'Início', 'Minutos', 'Golos', 'Cartões']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' }, // Darker header for report
        styles: { fontSize: 10, cellPadding: 3 },
        alternateRowStyles: { fillColor: [241, 245, 249] } // Slate 50
    });

    // -- Observations Field (Large Box) --
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check if we need a new page
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0,0,0);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES DO JOGO:", 14, finalY);

    // Pre-filled notes if existing
    if (match.notes) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitNotes = doc.splitTextToSize(match.notes, 180);
        doc.text(splitNotes, 14, finalY + 7);
        finalY += (splitNotes.length * 5) + 5;
    } else {
        // Draw a box for manual writing if printed
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, finalY + 2, 182, 40); // x, y, w, h
    }

    addFooter(doc);
    doc.save(`FichaJogo_${match.date}_${match.opponent}.pdf`);
}

// 3. RELATÓRIO DE TREINO (TRAINING SHEET - Attendance & Obs)
export const generateTrainingSessionPDF = async (
    session: TrainingSession,
    squad: Squad,
    players: Player[],
    attendance: AttendanceRecord[]
) => {
    const doc = new jsPDF();
    const startY = await addHeader(doc, `TREINO - ${squad.name}`, "Relatório de Treino");

    // -- Session Details --
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    let detailsY = startY;

    doc.setFont("helvetica", "bold"); doc.text("Data:", 14, detailsY);
    doc.setFont("helvetica", "normal"); doc.text(`${session.date} às ${session.time}`, 30, detailsY);
    
    doc.setFont("helvetica", "bold"); doc.text("Descrição:", 14, detailsY + 6);
    doc.setFont("helvetica", "normal"); doc.text(session.description, 35, detailsY + 6);

    // -- Attendance Table --
    const squadPlayers = players.filter(p => p.squadId === session.squadId)
        .sort((a,b) => Number(a.jerseyNumber) - Number(b.jerseyNumber));

    const tableData = squadPlayers.map(p => {
        const record = attendance.find(a => a.sessionId === session.id && a.playerId === p.id);
        const status = record?.status || "N/A";
        return [p.jerseyNumber, p.name, status];
    });

    // Calculate Summary
    const presentCount = attendance.filter(a => a.sessionId === session.id && a.status === AttendanceStatus.PRESENT).length;
    const absentCount = attendance.filter(a => a.sessionId === session.id && a.status === AttendanceStatus.ABSENT).length;
    const injuredCount = attendance.filter(a => a.sessionId === session.id && a.status === AttendanceStatus.INJURED).length;

    doc.setFontSize(10);
    doc.text(`Presentes: ${presentCount} | Ausentes: ${absentCount} | Lesionados: ${injuredCount}`, 14, detailsY + 15);

    autoTable(doc, {
        startY: detailsY + 20,
        head: [['#', 'Nome', 'Presença']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
                const text = data.cell.raw as string;
                if (text === AttendanceStatus.PRESENT) data.cell.styles.textColor = [21, 128, 61]; // Green
                else if (text === AttendanceStatus.ABSENT) data.cell.styles.textColor = [185, 28, 28]; // Red
                else if (text === AttendanceStatus.INJURED) data.cell.styles.textColor = [194, 65, 12]; // Orange
            }
        }
    });

    // -- Observations Field --
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY > 250) { doc.addPage(); finalY = 20; }

    doc.setFontSize(12);
    doc.setTextColor(0,0,0);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES DO TREINO:", 14, finalY);

    if (session.notes) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitNotes = doc.splitTextToSize(session.notes, 180);
        doc.text(splitNotes, 14, finalY + 7);
    } else {
        // Box for manual writing
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, finalY + 2, 182, 50);
    }

    addFooter(doc);
    doc.save(`Treino_${squad.name}_${session.date}.pdf`);
}