import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useState } from "react";
import { ATTENDANCE_UI } from "../constants/attendanceUiMessages";

const ManageAttendance = () => {
  /* =======================
     SCANNER STATE
     ======================= */
  const [message, setMessage] = useState("");
  const [state, setState] = useState("");
  const [scanLocked, setScanLocked] = useState(false);

  /* =======================
     TIMESHEET STATE
     ======================= */
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userId, setUserId] = useState("");
  const [downloadError, setDownloadError] = useState("");

  /* =======================
     DESKTOP CHECK
     ======================= */
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 990);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 990);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* =======================
     QR SCANNER LOGIC
     ======================= */
  useEffect(() => {
    if (!isDesktop) return;

    const scanner = new Html5QrcodeScanner(
      "qr-scanner",
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        rememberLastUsedCamera: true,
        showImageScan: false,
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        if (scanLocked) return;
        setScanLocked(true);

        try {
          const res = await fetch("/api/attendance/mark", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
            },
            body: JSON.stringify({ token: decodedText }),
          });

          if (!res.ok) {
            if (res.status === 410) throw new Error("EXPIRED");
            throw new Error("INVALID");
          }

          const data = await res.json();

          setState(data.state);
          setMessage(
            ATTENDANCE_UI[data.state]?.text || "Attendance updated"
          );

          scanner.clear();
        } catch (e) {
          setState("");
          setMessage(
            e.message === "EXPIRED"
              ? "QR expired. Ask user to regenerate QR."
              : "Invalid QR. Please scan again."
          );
          setScanLocked(false);
        }
      },
      () => {}
    );

    return () => scanner.clear();
  }, [isDesktop, scanLocked]);

  /* =======================
     TIMESHEET DOWNLOAD
     ======================= */
  const downloadTimesheet = async () => {
    setDownloadError("");

    if (!startDate || !endDate) {
      setDownloadError("Please select start and end dates");
      return;
    }

    const body = {
      startDate,
      endDate,
      ...(userId && { userId }),
    };

    try {
      const res = await fetch(
        "/api/admin/attendance/percentage/download",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Unable to download timesheet");
    }
  };

  /* =======================
     UI
     ======================= */
  return (
    <div className="space-y-6 p-4">
      <div className="bg-white/60 rounded-xl p-4 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-amber-950">
          Manage Attendance and Timesheet
        </h1>
      </div>

      {/* Scanner */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="font-semibold mb-4">Scan Attendance QR</h2>

        <div className="flex gap-6">
          <div id="qr-scanner" />

          {message && (
            <div
              className={`px-4 py-3 rounded-lg font-semibold
                ${
                  state === "COMPLETED"
                    ? "bg-green-100 text-green-700"
                    : state === "CHECKED_IN"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Timesheet */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="font-semibold mb-4">Download Timesheet</h2>

        <div className="flex gap-3 flex-wrap">
          <input
            type="date"
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <input
            type="date"
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <input
            placeholder="User ID (optional)"
            onChange={(e) => setUserId(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />

          <button
            onClick={downloadTimesheet}
            className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800"
          >
            Download CSV
          </button>
        </div>

        {downloadError && (
          <p className="text-red-600 mt-3">{downloadError}</p>
        )}
      </div>
    </div>
  );
};

export default ManageAttendance;
