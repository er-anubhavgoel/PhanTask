import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useState } from "react";
import { ATTENDANCE_UI } from "../constants/attendanceUiMessages";
import LoadingSkeleton from "../components/LoadingSkeleton";

/* -------- MAIN COMPONENT -------- */
const ManageAttendance = () => {
  /* =======================
     SCANNER STATE
     ======================= */
  const [message, setMessage] = useState("");
  const [state, setState] = useState("");
  const [isScanning, setIsScanning] = useState(true);
  const [scannedToken, setScannedToken] = useState("");

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

          scanner.clear(); // stop after success
        } catch (e) {
          setState("");
          setMessage(
            e.message === "EXPIRED"
              ? "QR expired. Ask user to regenerate QR."
              : "Invalid QR. Please scan again."
          );
        }
      },
      () => {}
    );

    return () => scanner.clear();
  }, [isDesktop]);

  /* =======================
     TIMESHEET DOWNLOAD
     ======================= */
  const downloadTimesheet = () => {
    setDownloadError("");

    if (!startDate || !endDate) {
      setDownloadError("Please select start and end dates");
      return;
    }

    console.log("Downloading timesheet:", {
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
     DESKTOP ONLY MESSAGE
     ======================= */
  if (!isDesktop) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <h1 className="text-2xl font-bold mb-4 text-amber-950">
            Desktop Access Required
          </h1>
          <p className="text-gray-700">
            Manage Attendance is available only on screens wider than{" "}
            <span className="font-semibold">990px</span>.
          </p>
        </div>
      </div>
    );
  }

  /* =======================
     UI
     ======================= */
  return (
    <div className="space-y-6 p-4">
      {/* PAGE HEADER */}
      <div className="mb-3 bg-white/60 rounded-xl p-4 shadow-sm border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-amber-950">
          Manage Attendance and Timesheet
        </h1>
      </div>

      {/* ===== SCANNER CARD ===== */}
      <div className="bg-white/80 rounded-xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Scan Attendance QR
        </h2>

        <div className="flex gap-6 items-start">
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

      {/* ===== TIMESHEET CARD ===== */}
      <div className="bg-white/80 rounded-xl shadow-md border border-amber-300 p-6">
        <h2 className="text-lg font-bold text-amber-800 mb-4">
          Download Attendance Timesheet
        </h2>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm"
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Start Date"
          />
          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm"
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="End Date"
          />
          <input
            placeholder="User ID (optional)"
            className="border rounded-lg px-3 py-2 text-sm"
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID (optional)"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
          />

          <button
            onClick={downloadTimesheet}
            className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800 hover:scale-95 transition-transform text-sm font-semibold"
          >
            Download CSV
          </button>
        </div>

        {downloadError && (
          <p className="text-red-600 text-sm mt-3">
            {downloadError}
          </p>
        )}
      </div>
    </div>
  );
};

export default ManageAttendance;
