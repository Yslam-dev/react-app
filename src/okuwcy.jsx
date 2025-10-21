import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";

// API Bazaly URL
const API_URL = import.meta.env.VITE_API_URL;

// --- KÖMEKÇI FUNKSIÝALAR ---

// ❗️ Student maglumatlarynda ady tapmak üçin kömekçi funksiýa
const getStudentName = (studentInfo) => {
    if (!studentInfo) return 'Okuwçy';
    if (studentInfo.surname) return studentInfo.surname;
    if (studentInfo.first_name || studentInfo.last_name) {
        const parts = [studentInfo.first_name, studentInfo.last_name].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : 'Okuwçy';
    }
    return 'Undefined Ady';
};

// ❗️ KÖMEKÇI FUNKSIÝA: Soraglary we jogap opsiýalaryny garyşdyrmak (Fisher-Yates algoritminiň göçürmesi)
const shuffleArray = (array) => {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// ❗️ KÖMEKÇI KOMPONENT: Alert (Stili özüňiz goşuň)
const CustomAlert = ({ message, onClose }) => {
    if (!message) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <p className="modal-text">{message}</p>
                <button onClick={onClose} className="btn btn-green">
                    Bolýar
                </button>
            </div>
        </div>
    );
};

// --- ESASY KOMPONENT ---

export default function OkuwcyApp({ onBack, studentInfo }) {

    if (!studentInfo || !studentInfo.group || !studentInfo.id) {
        console.error("OkuwcyApp: Talap edilýän maglumatlar (id, group) ýok.");
        return (
            <div className="app-bg">
                <main className="main-container">
                    <p>Okuwçy maglumatlary ýok. Yza dolanyň.</p>
                    <button onClick={onBack}>← Yza</button>
                </main>
            </div>
        );
    }

    const studentName = getStudentName(studentInfo);
    const studentId = studentInfo.id;
    const studentGroup = studentInfo.group;
    const access = localStorage.getItem("access");
    const timerRef = useRef(null);

    // 🔥 useMemo bilen HTTP sazlamalaryny ýatda saklamak
    const axiosConfig = useMemo(() => ({
        headers: {
            Authorization: `Bearer ${access}`
        }
    }), [access]);


    // --- State Üýtgeýjileri ---
    const [view, setView] = useState("okuwcyHome");
    const [savedTests, setSavedTests] = useState(() => {
        const storedSaved = localStorage.getItem(`savedTests_${studentId}`);
        return storedSaved ? JSON.parse(storedSaved) : [];
    });
    const [completedTests, setCompletedTests] = useState(() => {
        const storedCompleted = localStorage.getItem(`completedTests_${studentId}`);
        return storedCompleted ? JSON.parse(storedCompleted) : [];
    });
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [isQuizFinished, setIsQuizFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [alertMessage, setAlertMessage] = useState("");
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewedTest, setReviewedTest] = useState(null);
    const [currentTestGiveId, setCurrentTestGiveId] = useState(null);


    // 🔥 Kömekçi Logika: Timer we format
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    };


    // --- Testi tamamlamak (completeQuiz) ---
    const completeQuiz = useCallback(async (finalScore, isTimeout = false, finalQuestions = quizQuestions) => {
        setIsQuizFinished(true);
        clearInterval(timerRef.current);

        const testToMove = savedTests.find((t) => t.id === currentTestGiveId);
        if (!testToMove) {
            setView("okuwcyHome");
            return;
        }
        const totalQuestions = finalQuestions.length;
        const localTempId = `temp-${Date.now()}`;

        // 1. WAGTLAÝYN LOKAL ÝAZGY DÖRETMEK
        const localTestWithResults = {
            id: localTempId,
            score: finalScore,
            totalQuestions: totalQuestions,
            dateCompleted: new Date().toLocaleDateString("tk-TM"),
            reviewQuestions: finalQuestions,
            number_corrected: finalScore,
            ball: totalQuestions,
            give_information: currentTestGiveId, // Bu möhüm: TestGive ID-si
            given_group: studentGroup,
            test_information: testToMove.test_information || { theme: testToMove.test_theme || 'Ýok', id: testToMove.test_id || null },
        };

        // UI täzele (Callback ulanyp, dogry state ýagdaýyny ulanmak üçin)
        setCompletedTests(prev => {
            const updated = [...prev, localTestWithResults];
            localStorage.setItem(`completedTests_${studentId}`, JSON.stringify(updated));
            return updated;
        });

        // 🔥 DÜZELDIŞ: Testi diňe okuwçynyň öz lokal sanawyndan aýyrýar.
        setSavedTests(prev => {
            const updated = prev.filter((t) => t.id !== currentTestGiveId);
            localStorage.setItem(`savedTests_${studentId}`, JSON.stringify(updated));
            return updated;
        });


        const finalPercentage = totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 100) : 0;
        setAlertMessage(isTimeout
            ? `Wagt gutardy! Netijeňiz: ${finalPercentage}%`
            : `Test tamamlandy! Netijeňiz: ${finalPercentage}%`);

        // 3. API Çagyryşy (Internet bar bolsa)
        if (isOnline) {
            try {
                const historyData = {
                    number_corrected: finalScore,
                    ball: totalQuestions,
                    user: studentId,
                    give_information: currentTestGiveId,
                    given_group: studentGroup,
                    test_information: testToMove.test_information?.id || testToMove.test_id,
                    review_questions: finalQuestions,
                };

                const historyRes = await axios.post(`${API_URL}/api/tests/tests/history/create/`, historyData, axiosConfig);
                const historyServerId = historyRes.data.id;

                // 4. LOKAL ÝAZGYNY SERVER MAGLUMATLARY BILEN ÇALŞYR
                setCompletedTests(prev => {
                    const serverTestHistory = {
                        ...localTestWithResults,
                        id: historyServerId,
                        dateCompleted: historyRes.data.date_completed ? new Date(historyRes.data.date_completed).toLocaleDateString("tk-TM") : 'Bellenmedik',
                        test_information: historyRes.data.test_information,
                        reviewQuestions: finalQuestions,
                    };

                    const finalCompletedTests = prev.map(t =>
                        String(t.id) === localTempId ? serverTestHistory : t
                    );

                    localStorage.setItem(`completedTests_${studentId}`, JSON.stringify(finalCompletedTests));
                    return finalCompletedTests;
                });

                // DELETE çagyryşy bolmadyklygy sebäpli, TestGive beýleki okuwçylara görünmäge dowam eder

                setAlertMessage("Test netijeleri serwere üstünlikli ugradyldy!");
            } catch (error) {
                console.error("Netijeleri serwerde saklap bilmedim:", error.response?.data || error);
                setAlertMessage("Serwer näsazlygy. Netijeler ýerli ýagdaýda saklandy, online bolanyňyzda täzeden synanyşyň.");
            }
        }


        setTimeout(() => {
            setView("okuwcyHome");
        }, 5000);
    }, [currentTestGiveId, isOnline, savedTests, studentId, studentGroup, quizQuestions, axiosConfig]);


    // --- useEffect Logikasy: API Ýükleme we Süzme ---

    // 1. Timer Logikasy
    useEffect(() => {
        // ... (Öňki Timer Kody) ...
        if (view === "quiz" && !isQuizFinished && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerRef.current);
                        completeQuiz(score, true, quizQuestions);
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        } else if (timeLeft === 0 || isQuizFinished) {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [view, isQuizFinished, timeLeft, score, quizQuestions, completeQuiz]);

    // 2. Internet Baglanyşygyny Barlamak
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 3. 🔥 API bilen maglumat almak (Testleri we Taryhy ýükle we SÜZME)
    useEffect(() => {

        if (!studentId || !studentGroup || !access) {
            setIsLoading(false);
            return;
        }

        const fetchAndSetTests = async () => {
            setIsLoading(true);
            try {
                // Bir wagtda çagyryş: Gruppa berlen testler we Okuwçynyň taryhy
                const [savedRes, completedRes] = await Promise.all([
                    axios.get(`${API_URL}/api/tests/tests/give/list/?given_group=${studentGroup}`, axiosConfig),
                    // ❗ DÜZELDIŞ: API-dan diňe şu okuwçynyň taryhyny alýar (eger API goldaýan bolsa)
                    axios.get(`${API_URL}/api/tests/tests/history/list/?user=${studentId}`, axiosConfig)
                ]);

                const allGiveTests = savedRes.data || [];
                const allCompletedTestsHistory = completedRes.data || [];

                // ❗ IŇ ESASY DÜZELDIŞ: Tabşyrylan TestGive ID-lerini tapmak
                const completedGiveIds = new Set(
                    allCompletedTestsHistory
                        // Diňe 'give_information' (TestGive ID) meýdany bar bolanlary alýar
                        .filter(h => h.give_information)
                        .map(h => String(h.give_information))
                );

                // ❗ Okuwçy üçin görkezilmeli testleri süzmek: Heniz **tamamlanmadyk** TestGive ID-leri
                const newSavedTests = allGiveTests.filter(t => !completedGiveIds.has(String(t.id)));


                const processedCompletedTests = allCompletedTestsHistory
                    .filter(test => test.id)
                    .map(test => ({
                        ...test,
                        id: test.id,
                        score: test.number_corrected || 0,
                        totalQuestions: test.ball || 0,
                        dateCompleted: test.date_completed ? new Date(test.date_completed).toLocaleDateString("tk-TM") : 'Bellenmedik',
                        reviewQuestions: test.review_questions || [],
                        test_information: test.test_information || { theme: test.test_theme || 'Ýok' },
                    }));

                // Lokal Storage-dan wagtlaýyn (temp-) ID-li testleri alyp, serverden gelmediklerini süzmek
                const localCompleted = JSON.parse(localStorage.getItem(`completedTests_${studentId}`) || '[]');
                const serverCompletedIds = new Set(processedCompletedTests.map(t => String(t.id)));

                const pendingLocalTests = localCompleted.filter(t =>
                    String(t.id).startsWith('temp-') || !serverCompletedIds.has(String(t.id))
                );

                const finalCompletedTests = [...processedCompletedTests, ...pendingLocalTests];

                setSavedTests(newSavedTests); // 🔥 SÜZÜLEN SANAWY ÝÜKLE
                setCompletedTests(finalCompletedTests);

                // Lokal Storage-y täzele
                localStorage.setItem(`savedTests_${studentId}`, JSON.stringify(newSavedTests));
                localStorage.setItem(`completedTests_${studentId}`, JSON.stringify(finalCompletedTests));

                setAlertMessage("Testler serwerden üstünlikli ýüklendi.");
            } catch (error) {
                console.error("API-dan maglumat ýüklenmedi:", error.response?.data || error);
                setAlertMessage("Testler ýüklenmedi. Internetiňizi barlaň, ýerli maglumatlar ulanylar.");
            }
            setIsLoading(false);
        };

        fetchAndSetTests();
    }, [studentGroup, studentId, access, axiosConfig]);


    // --- Komponent Funksiýalary (start, handleAnswer, delete, we beýlekiler) ---

    const startOkuwcyQuiz = (testGiveItem) => {
        const questionsToGive = testGiveItem.given_questions || [];
        const questionCount = questionsToGive.length;
        const duration = testGiveItem.duration_minutes || 0;

        if (!isOnline) {
            setAlertMessage("Testi başlamak üçin Internet baglanyşygy talap edilýär.");
            return;
        }

        if (questionCount <= 0 || duration <= 0) {
            setAlertMessage("Mugallym test sazlamady ýa-da sorag ýok. Soňrak synanşyň.");
            return;
        }

        setCurrentTestGiveId(testGiveItem.id);

        // SORAGLARYŇ SAHYPALARYNY GARYŞDYRMAK (Okuwçy üçin täze tertip)
        const shuffledQuestionsList = shuffleArray(questionsToGive);

        const shuffledQuizQuestions = shuffledQuestionsList.map((q) => ({
            ...q,
            // Jogap opsiýalaryny garyşdyr
            shuffledAnswers: shuffleArray((q.answers || []).filter((a) => a && String(a).trim() !== "")),
            userAnswer: null,
            isCorrect: null,
            correct_answer: q.correct_answer,
            question_text: q.question_text,
        }));

        setQuizQuestions(shuffledQuizQuestions);
        setQuizCurrentIndex(0);
        setScore(0);
        setIsQuizFinished(false);
        setTimeLeft(duration * 60);
        setView("quiz");
    };

    const handleAnswerSelection = (answer) => {
        if (isQuizFinished || !isOnline) return;

        const currentQuestion = quizQuestions[quizCurrentIndex];
        if (currentQuestion.userAnswer !== null) return;

        // TRIM ulanylyp deňeşdirme
        const isAnswerCorrect = String(answer).trim() === String(currentQuestion.correct_answer).trim();

        const updatedQuestions = [...quizQuestions];
        updatedQuestions[quizCurrentIndex] = {
            ...currentQuestion,
            userAnswer: answer,
            isCorrect: isAnswerCorrect,
        };

        let newScore = score;
        if (isAnswerCorrect) {
            newScore++;
        }

        setQuizQuestions(updatedQuestions);
        setScore(newScore);

        if (quizCurrentIndex + 1 < quizQuestions.length) {
            // Indiki sowala geçmek üçin 300ms garaş
            setTimeout(() => setQuizCurrentIndex((prev) => prev + 1), 300);
        } else {
            completeQuiz(newScore, false, updatedQuestions);
        }
    };

    const handleDeleteCompletedTest = async (testHistoryId) => {
        const idToDelete = String(testHistoryId);
        const testToDelete = completedTests.find((t) => String(t.id) === idToDelete);

        if (!testToDelete) return;

        if (!window.confirm(`"${testToDelete.test_information?.theme || "Bu test"}" netijesini pozmak isleýäňizmi?`)) return;

        // UI-y we Lokal Storage-y deslapky täzele (optimistik täzeleme)
        const updatedCompletedTests = completedTests.filter((t) => String(t.id) !== idToDelete);
        setCompletedTests(updatedCompletedTests);
        localStorage.setItem(`completedTests_${studentId}`, JSON.stringify(updatedCompletedTests));

        // Server ID-si bar bolsa we online bolsa, serwerden poz
        if (isOnline && !idToDelete.startsWith('temp-')) {
            try {
                await axios.delete(`${API_URL}/api/tests/tests/history/${idToDelete}/`, axiosConfig);
                setAlertMessage("Test üstünlikli pozuldy (Serwer).");
            } catch (error) {
                console.error("Tamamlanan testi pozanda näsazlyk boldy:", error);
                // Näsazlyk ýüze çyksa, taryhy yzyna gaýtarmak
                setCompletedTests(completedTests);
                localStorage.setItem(`completedTests_${studentId}`, JSON.stringify(completedTests));
                setAlertMessage('Testi pozmakda näsazlyk boldy. Internetiňizi barlaň ýa-da serwer ýalňyşlygy.');
            }
        } else if (idToDelete.startsWith('temp-')) {
            setAlertMessage("Test ýerli ýagdaýda pozuldy.");
        } else {
            setAlertMessage("Internet ýok. Lokal ýazgy pozuldy, ýöne serwerden pozmak synanyşygy ýok.");
        }
    };

    const restartQuiz = () => {
        // State-leri başlangyç ýagdaýyna getir
        setQuizQuestions([]);
        setQuizCurrentIndex(0);
        setScore(0);
        setIsQuizFinished(false);
        clearInterval(timerRef.current);
        setReviewedTest(null);
        setView("okuwcyHome");
    };

    const showHistory = () => setView("history");
    const showTestReview = (test) => {
        setReviewedTest(test);
        setView("historyReview");
    };


    // --- Render Funksiýalary ---

    const renderOquwcyHome = () => (
        <>
            <div className="button-bottom">
                <button className="btn btn-green">Testler</button>
                <button className="btn btn-gray" onClick={showHistory}>
                    Taryh
                </button>
            </div>
            {isLoading ? (
                <div className="loading-message">Testler ýüklenýär...</div>
            ) : savedTests.length > 0 ? (
                <div className="card-grid">
                    {[...savedTests].reverse().map((t) => (
                        <div key={t.id} className="test-card card-two-column-layout">
                            <div className="column-left">
                                <div className="tema-wrap">Tema: **{t.test_theme || t.test_information?.theme || "Ýok"}**</div>
                                <div className="mugallym-info">
                                    <span>Topar: {t.given_group || studentGroup}</span>
                                </div>
                                <div className="count">
                                    Sorag sany: **{t.given_questions?.length || "Bellenmedi"}**
                                </div>
                            </div>
                            <div className="column-right okuwcy-btns">
                                {t.duration_minutes > 0 && t.given_questions?.length > 0 ? (
                                    <button
                                        className={`btn ${!isOnline ? 'btn-gray' : 'btn-green'}`}
                                        onClick={() => startOkuwcyQuiz(t)}
                                        disabled={!isOnline}
                                    >
                                        Başla ({t.duration_minutes} min)
                                    </button>
                                ) : (
                                    <span className={`info-text ${!isOnline ? "info-red" : ""}`}>
                                        {!isOnline ? "Offline." : "Mugallym tarapyndan açylmady..."}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-tests-message">Täze test ýok.</p>
            )}
        </>
    );

    const renderQuiz = () => {
        const currentQuestion = quizQuestions[quizCurrentIndex];
        return (
            <div className="quiz-card">
                {!isQuizFinished ? (
                    <>
                        <div className="button-row">
                            <h3 className="quiz-question-title">
                                Sorag {quizCurrentIndex + 1} / {quizQuestions.length}
                            </h3>
                            <div className={`timer-display ${timeLeft <= 60 && isOnline ? "timer-danger" : ""}`}>
                                **{isOnline ? formatTime(timeLeft) : "🔴 Offline 🔴"}**
                            </div>
                        </div>
                        <p className="quiz-question">{currentQuestion?.question_text}</p>
                        {!isOnline && <p className="info-text info-red">Internet ýok. Jogap berip bolmaz!</p>}
                        <div className="quiz-answers-container">
                            {(currentQuestion?.shuffledAnswers || []).map((ans, i) => {
                                const isSelected = String(currentQuestion.userAnswer).trim() === String(ans).trim();

                                return (
                                    <button
                                        key={i}
                                        className={`quiz-answer-btn ${isSelected ? 'btn-selected' : ''}`}
                                        onClick={() => handleAnswerSelection(ans)}
                                        disabled={!isOnline || currentQuestion.userAnswer !== null}
                                    >
                                        {ans}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            className="btn btn-red mt-4"
                            onClick={() => completeQuiz(score, false, quizQuestions)}
                            disabled={!isOnline || isQuizFinished}
                        >
                            Testi Tamamla
                        </button>
                    </>
                ) : (
                    <div className="results-container">
                        <h2>Test tamamlandy! 🎉</h2>
                        <p>
                            Netijeňiz:{" "}
                            <span className="score-percentage">
                                **{quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0}%**
                            </span>
                            <br />
                            Dogry jogap: **{score}** / {quizQuestions.length}
                        </p>
                        <button className="btn btn-green back-to-home" onClick={restartQuiz}>
                            Baş sahypa dolan
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderHistory = () => (
        <>
            <div className="button-bottom">
                <button className="btn btn-gray" onClick={() => setView("okuwcyHome")}>
                    Testler
                </button>
                <button className="btn btn-green">Taryh</button>
            </div>
            {completedTests.length > 0 ? (
                <div className="card-grid history-card-grid">
                    {[...completedTests].reverse().map((t) => (
                        <div key={t.id} className="test-card card-two-column-layout">
                            <div className="column-left">

                                <div className="tema-wrap">Tema: **{t.test_theme || "Ýok"}**</div>
                                <div className="mugallym-info">
                                    <br />

                                </div>
                                <div className="count">
                                    Netije: **{t.number_corrected || 0}** / {t.ball || 0} (
                                    **{t.ball > 0 ? Math.round(((t.number_corrected || 0) / t.ball) * 100) : 0}%**)
                                    {String(t.id).startsWith('temp-') && <span className="info-text info-red"> (❌ Serwerde ýok!)</span>}
                                </div>
                            </div>
                            <div className="column-right okuwcy-btns">
                                {t.reviewQuestions && t.reviewQuestions.length > 0 ? (
                                    <button className="btn btn-blue" onClick={() => showTestReview(t)}>
                                        Gör
                                    </button>
                                ) : (
                                    <span className="info-text info-gray">Jikme-jiklik ýok</span>
                                )}

                                {/* <button
                                    className="btn btn-red"
                                    onClick={() => handleDeleteCompletedTest(t.id)}
                                >
                                    Poz
                                </button> */}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-tests-message">Geçen test ýok.</p>
            )}
        </>
    );

    const renderHistoryReview = () => (
        <div className="quiz-card review-card">
            <button className="back-btn" onClick={() => setView('history')}>← Yza</button>
            <h2>"{reviewedTest?.test_information?.theme || "Test"}" testiniň jikme-jikligi 🧐</h2>
            <p>
                Netije: **{reviewedTest?.number_corrected}** / {reviewedTest?.ball} (
                **{reviewedTest?.ball > 0 ? Math.round((reviewedTest?.number_corrected / reviewedTest?.ball) * 100) : 0}%**)
            </p>
            <div className="review-questions">
                {(reviewedTest?.reviewQuestions || []).map((q, i) => (
                    <div key={i} className={`review-item ${q.isCorrect ? "review-correct" : "review-incorrect"}`}>
                        <p className="review-q-tema">
                            **Sorag {i + 1}**: {q.question_text}
                        </p>
                        <div className="review-answers-container">
                            {(q.shuffledAnswers || q.answers || []).map((ans, j) => {
                                const isUserAnswer = String(q.userAnswer).trim() === String(ans).trim();
                                const isCorrectAnswer = String(q.correct_answer).trim() === String(ans).trim();

                                return (
                                    <div
                                        key={j}
                                        className={`review-answer-btn 
                                            ${isCorrectAnswer ? "correct" : ""} 
                                            ${isUserAnswer && !isCorrectAnswer ? "incorrect" : ""} 
                                        `}
                                    >
                                        {ans}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="review-info">
                            Siziň jogabyňyz:{" "}
                            <span className={q.isCorrect ? "correct-text" : "incorrect-text"}>
                                **{q.userAnswer || "Jogap berilmedik"}**
                            </span>
                            <br />
                            Dogry jogap: <span className="correct-text">**{q.correct_answer}**</span>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderView = () => {
        switch (view) {
            case "okuwcyHome":
                return renderOquwcyHome();
            case "quiz":
                return renderQuiz();
            case "history":
                return renderHistory();
            case "historyReview":
                return renderHistoryReview();
            default:
                return null;
        }
    };

    // --- Esasy Return (Doly Komponent Gurluşy) ---
    return (
        <div className="app-bg">
            <header className="app-header">
                <div className="header-info">
                    <h1>🎓 Okuwçy Paneli</h1>
                    <p>Salam, **{studentName}** ({studentGroup || 'Undefined'})!</p>
                </div>
                <button className="btn btn-red btn-logout-fixed" onClick={onBack}>
                    Çykyş
                </button>
            </header>
            <main className="main-container">
                <CustomAlert message={alertMessage} onClose={() => setAlertMessage("")} />
                {(view !== "okuwcyHome" && view !== "quiz" && view !== 'history') && (
                    <button
                        className="back-btn"
                        onClick={() => {
                            if (view === "historyReview") setView("history");
                            else setView("okuwcyHome");
                        }}
                    >
                        ← Yza
                    </button>
                )}

                {renderView()}
            </main>
            <footer className="app-footer">
                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                <p className="status-text">{isOnline ? 'Online' : 'Offline'}</p>
            </footer>
        </div>
    );
}