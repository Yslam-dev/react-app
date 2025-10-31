import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// API Bazaly URL
// ❗️ ÜNS BERIŇ: Bu üýtgeýji proýektiňizde gurluşyndaky (VITE_API_URL) maglumatlaryndan gelmeli.
const API_URL = import.meta.env.VITE_API_URL;

// ❗️ KÖMEKÇI FUNKSIÝA: Massiwi Garyşdyrmak (Fisher-Yates algoritmi) - BU FUNKSIÝA TALABYŇYZ BOÝUNÇA AÝRYLDY
// const shuffleArray = (array) => { ... };

// ❗️ KÖMEKÇI FUNKSIÝA: Sorag-jogap maglumatlaryny formatlamak (Jikme-jiklik üçin möhüm)
const formatReviewQuestions = (questions) => {
    if (!questions || !Array.isArray(questions)) return [];

    return questions.map(q => {
        // Jogaplary has ynamly deňeşdirmek üçin: trim() we kiçi harp (toLowerCase()) ulanylyp deňeşdirilýär.
        const userAnswerTextClean = String(q.userAnswer || 'Jogap berilmedi').trim().toLowerCase();
        const correctAnswerTextClean = String(q.correct_answer || q.correctAnswer || 'Dogry jogap ýok').trim().toLowerCase();

        return {
            question_text: q.question_text || q.qTema || 'Sorag Teksti Ýok',
            userAnswer: String(q.userAnswer || 'Jogap berilmedi').trim(), // UI üçin esasy tekst
            correctAnswer: String(q.correct_answer || q.correctAnswer || 'Dogry jogap ýok').trim(), // UI üçin esasy tekst
            answers: q.answers || [], // Dürli jogaplar
            // Deňeşdirme
            isCorrect: userAnswerTextClean === correctAnswerTextClean,
        };
    });
};

export default function MugallymApp({ onBack }) {
    // State üýtgeýjileri
    const [view, setView] = useState('mugallymHome');
    const [theme, setTema] = useState('');
    const [number_question, setPeople] = useState(1);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [savedTests, setSavedTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [analyzedTest, setAnalyzedTest] = useState(null); // Redaktirlemek üçin maglumat
    const [wagt, setWagt] = useState(0); // Test ugratmak üçin wagt
    const [group, setGroup] = useState(''); // Test ugratmak üçin topar
    const [peopleCount, setPeopleCount] = useState(0); // Ugradylmaly sowal sany
    const [alertMessage, setAlertMessage] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [mugallymName, setMugallymName] = useState('');

    // Taryh maglumatlaryny saklamak üçin state
    const [studentsByGroup, setStudentsByGroup] = useState({});
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentReviewTest, setStudentReviewTest] = useState(null);

    // Funksiýalar
    const handleLogout = () => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("mugallymName");
        onBack();
    };

    // Internet baglanyşygyny barlamak
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

    // API çagyryşlary we maglumat ýükleme (Mugallymyň ady, Testler we Taryh)
    useEffect(() => {
        const token = localStorage.getItem("access");
        const storedMugallymName = localStorage.getItem('mugallymName');
        if (storedMugallymName) {
            setMugallymName(storedMugallymName);
        }

        if (!token) {
            console.error("Token tapylmady. Giriş sahypasyna gönükdirilýär.");
            onBack();
            return;
        }

        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        // Testleri (Mugallymyň döredenleri) çekmek
        const fetchTests = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/tests/tests/list/`, axiosConfig);
                setSavedTests(response.data);
            } catch (error) {
                console.error("Test maglumatlaryny alanda näsazlyk boldy:", error);
                if (error.response && error.response.status === 401) {
                    handleLogout();
                }
            }
        };

        // Tamamlanan testleri (Taryh) çekmek
        const fetchCompletedTests = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/tests/tests/history/list/`, axiosConfig);
                const completed = response.data || [];

                const grouped = completed.reduce((acc, test) => {
                    // 1. Gruppa adyny has ynamly kesgitle (topar ady)
                    const groupName = test.given_group_number || 'Bellik Ýoga';

                    // 2. Talyp ID we Adyny has ynamly kesgitle (ady/familiýasy bolmaly)
                    let studentId;
                    let studentName;
                    let studentSurname;

                    if (test.user && typeof test.user === 'object') {
                        // test.user - obýekt (doly maglumat)
                        studentId = test.user.id;
                        // Talabyňyz boýunça: full_name ýa-da username/name
                        studentName = test.user.full_name || test.user.username || test.user.name || `Okuwçy ${test.user.id}`;
                        studentSurname = test.user.surname || `Okuwçy ${test.user.id}`;
                    } else if (test.user) {
                        // test.user - san (diňe ID)
                        studentId = test.user.id;
                        studentName = `Okuwçy ${test.user.id}`;
                    } else {
                        // Alternatiw: test.user_id ulan
                        studentId = test.user_id;
                        studentName = `Okuwçy ${test.user_id || 'Ýok'}`;
                    }

                    if (!studentId) {
                        console.warn("Talyp ID-si tapylmady. Ýazgy süzüldi:", test);
                        return acc;
                    }

                    if (!acc[groupName]) acc[groupName] = [];
                    let student = acc[groupName].find(s => s.id === studentId);

                    if (!student) {
                        // Täze talyp goş
                        student = {
                            id: studentId,
                            name: studentName,
                            surname: studentSurname, // Okuwçynyň ady/Familiýasy
                            group: groupName,
                            completedTests: []
                        };
                        acc[groupName].push(student);
                    }

                    // 4. Test maglumatyny goş we Review maglumaty üçin formatReviewQuestions ulanyň
                    student.completedTests.push({
                        id: test.id,
                        tema: test.test_information?.theme || test.test_theme || 'Tema ýok',
                        dateCompleted: test.date_completed ? new Date(test.date_completed).toLocaleDateString("tk-TM") : 'Bellik ýok',
                        score: test.number_corrected || 0,
                        totalQuestions: test.ball || 0,
                        // Review Questions (Jikme-jik jogaplar) dogry formatlamak
                        reviewQuestions: formatReviewQuestions(test.review_questions || []), // Boş bolsa, boş massiw ber
                    });

                    return acc;
                }, {});

                setStudentsByGroup(grouped);
            } catch (error) {
                console.error("Tamamlanan testleri alanda näsazlyk boldy:", error.response?.data || error);
                if (error.response && error.response.status === 401) {
                    handleLogout();
                } else {
                    setStudentsByGroup({});
                }
            }
        };

        fetchTests();
        fetchCompletedTests();
    }, [onBack]);

    // Test döretmek funksiýalary
    const resetState = () => {
        setTema('');
        setPeople(1);
        setQuestions([]);
        setCurrentIndex(0);
        setAnalyzedTest(null);
    };

    const startInputStage = () => setView('inputStage');
    const startTest = () => {
        if (!theme.trim() || number_question < 1) {
            setAlertMessage('Zerur ýeri dolduryň.');
            return;
        }
        const qs = Array.from({ length: number_question }, () => ({
            question_text: '',
            answers: ['', '', '', ''],
            correct_answer: '' // 1-nji jogap hemişe dogry jogap bolmaly
        }));
        setQuestions(qs);
        setCurrentIndex(0);
        setView('step2');
    };

    const handleQuestionChange = (e) => {
        const next = [...questions];
        const updatedQuestion = { ...next[currentIndex], question_text: e.target.value };
        next[currentIndex] = updatedQuestion;
        setQuestions(next);
    };

    const handleAnswerChange = (idx, value) => {
        const nextQuestions = [...questions];
        const updatedQuestion = { ...nextQuestions[currentIndex] };
        const updatedAnswers = [...updatedQuestion.answers];

        updatedAnswers[idx] = value;

        if (idx === 0) {
            // Dogry jogap hemişe 1-nji (idx 0) jogap bolmaly
            updatedQuestion.correct_answer = value;
        }

        updatedQuestion.answers = updatedAnswers;
        nextQuestions[currentIndex] = updatedQuestion;
        setQuestions(nextQuestions);
    };

    const deleteTest = async (testId) => {
        if (!testId) {
            setAlertMessage('Testi pozmak üçin ID tapylmady.');
            return;
        }

        const token = localStorage.getItem("access");
        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };
        try {
            await axios.delete(`${API_URL}/api/tests/tests/${testId}/`, axiosConfig);
            setSavedTests(prev => prev.filter(test => test.id !== testId));
            setAlertMessage('Test üstünlikli pozuldy.');
        } catch (error) {
            console.error("Testi pozanda näsazlyk boldy:", error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            } else {
                setAlertMessage('Testi pozmakda näsazlyk boldy. Internetiňizi barlaň.');
            }
        }
    };

    const saveCurrent = async () => {
        const token = localStorage.getItem("access");
        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        const q = questions[currentIndex];
        // Sowal ýa-da dogry jogap boş bolsa
        if (!q.question_text.trim() || !q.answers[0].trim()) {
            setAlertMessage('Suwaly we iň bolmanynda dogry jogap opsiýasyny (1-nji jogaby) dolduryň.');
            return;
        }

        if (currentIndex + 1 >= number_question) {
            // Ähli soraglar dolduryldy, testi sakla
            const newTest = {
                theme: theme,
                number_question: number_question,
                questions: questions.map(q => ({
                    question_text: q.question_text,
                    correct_answer: q.correct_answer,
                    answers: q.answers
                }))
            };

            try {
                const response = await axios.post(`${API_URL}/api/tests/tests/create/`, newTest, axiosConfig);
                setSavedTests(prev => [...prev, response.data]);
                setAlertMessage('Täze test üstünlikli döredildi!');
                setView('mugallymHome');
                resetState();
            } catch (error) {
                console.error("Testi saklanda näsazlyk boldy:", error);
                if (error.response && error.response.status === 401) {
                    handleLogout();
                } else {
                    setAlertMessage('Testi saklamakda näsazlyk boldy. Internetiňizi barlaň.');
                }
            }
        } else {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goBack = () => (currentIndex > 0) ? setCurrentIndex(currentIndex - 1) : setView('inputStage');

    // Test Ugratmak funksiýalary
    const handleUgratClick = (test) => {
        setSelectedTest(test);
        setWagt(test.wagt || 0);
        setGroup(test.group || '');
        setPeopleCount(test.number_question || 0); // Maksimum sowal sanyny başlangyç gymmat edip goý
        setView('timerSetup');
    };

    // ❗️ ESASY FUNKSIÝA: Test ugradylanda (JOGAPLARY GARYŞDYRMA FUNKSIÝASY ÇYKARLYP)
    const startMugallymQuiz = async () => {
        const token = localStorage.getItem("access");
        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        if (wagt < 1 || !group || group.length < 1 || peopleCount < 1 || peopleCount > selectedTest.number_question) {
            setAlertMessage('Dogry minut, Topar nomerini we ugradylmaly sowal sanyny giriziň. Sowal sanynyň testdäki sowal sanyndan köp bolmaly däldigini barlaň.');
            return;
        }

        // Seçilen sowal sany boýunça soraglary saýla
        // Jogaplar garyşdyrylman, asyl yzygiderliliginde ugradylýar.
        let givenQuestions = selectedTest.questions.slice(0, peopleCount);

        const updatedTestGive = {
            duration_minutes: wagt,
            number_given: peopleCount,
            given_group: group,
            test: selectedTest.id,
            // ❗️ Garyşdyrylmadyk soraglary (jogap opsiýalary bilen) ugrat
            given_questions: givenQuestions,
        };

        try {
            await axios.post(`${API_URL}/api/tests/tests/give/create/`, updatedTestGive, axiosConfig);
            setAlertMessage(`'${selectedTest.theme}' testi ${group} topary üçin ${wagt} minut wagt bilen, ${peopleCount} sowal ugradyldy.`);
            setView('mugallymHome');
        } catch (error) {
            console.error("Test sazlamalaryny täzelemede näsazlyk boldy:", error.response?.data || error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            } else {
                setAlertMessage(`Sazlamalary täzelemede näsazlyk boldy: ${error.response?.data?.detail || 'Näbelli ýalňyşlyk'}`);
            }
        }
    };

    // Test Redaktirleme funksiýalary
    const handleAnalysisClick = (test) => {
        // Redaktirlemek üçin test maglumatlaryny analyzedTest state-ine ýazýarys
        setAnalyzedTest(test);
        setView('analysis');
    };

    const handleEditQuestionText = (e, qIndex) => {
        const newQuestions = [...analyzedTest.questions];
        const updatedQuestion = { ...newQuestions[qIndex], question_text: e.target.value };

        newQuestions[qIndex] = updatedQuestion;

        setAnalyzedTest({ ...analyzedTest, questions: newQuestions });
    };

    const handleEditAnswerText = (value, qIndex, aIndex) => {
        const newQuestions = [...analyzedTest.questions];
        const updatedQuestion = { ...newQuestions[qIndex] };
        const newAnswers = [...updatedQuestion.answers];

        newAnswers[aIndex] = value;

        if (aIndex === 0) {
            // Dogry jogap hemişe birinji jogap bolmaly
            updatedQuestion.correct_answer = value;
        }

        updatedQuestion.answers = newAnswers;
        newQuestions[qIndex] = updatedQuestion;

        setAnalyzedTest({ ...analyzedTest, questions: newQuestions });
    };

    // ❗️ Düzedilen funksiýa
    const handleSaveEdit = async () => {
        const token = localStorage.getItem("access");
        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        try {
            // 1. Üýtgedilen maglumatlary serwere PUT zaprosy bilen ugratmak
            // analyzedTest state-i üýtgedilen maglumatlary saklaýar
            await axios.put(`${API_URL}/api/tests/tests/${analyzedTest.id}/`, analyzedTest, axiosConfig);

            // 2. State-i täzelemek: savedTests massiwini üýtgedilen analyzedTest bilen täzele
            // Bu, List sahypasyna gaýdyp geleniňizde täze maglumatlaryň görkezilmegini üpjün edýär
            setSavedTests(prev => prev.map(test => (test.id === analyzedTest.id) ? analyzedTest : test));

            setAlertMessage('Test üstünlikli üýtgedildi.');

            // 3. 1 sekuntdan soň Baş sahypa geçmek (SAHYPANY TÄZELEMÄN!)
            setTimeout(() => setView('mugallymHome'), 1000);

        } catch (error) {
            console.error("Testi redaktirlanda näsazlyk boldy:", error.response?.data || error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            } else {
                setAlertMessage('Redaktirlemede näsazlyk boldy. Internetiňizi barlaň.');
            }
        }
    };

    // Taryh funksiýalary
    const showHistory = () => {
        if (Object.keys(studentsByGroup).length > 0) {
            setView('groupList');
        } else {
            setAlertMessage('Heniz tamamlanan test tapylmady.');
        }
    };

    const deleteGroup = async (groupName) => {
        const isConfirmed = window.confirm(`${groupName} toparynyň ähli test taryhyny pozmak isleýäňizmi?`);
        if (!isConfirmed) return;

        const token = localStorage.getItem("access");
        const axiosConfig = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };
        try {
            // API çagyryşy: toparyň ähli taryhyny pozýar
            await axios.delete(`${API_URL}/api/tests/tests/history/group/${encodeURIComponent(groupName)}/`, axiosConfig);

            const updatedGroups = { ...studentsByGroup };
            delete updatedGroups[groupName];
            setStudentsByGroup(updatedGroups);

            setAlertMessage(`${groupName} toparynyň taryhy üstünlikli pozuldy.`);
            // Eger bu pozulandan soň toparyň ýeke täk bolan ýagdaýynda yza gaýtmak
            if (Object.keys(updatedGroups).length === 0) {
                setView('mugallymHome');
            }
        } catch (error) {
            console.error("Topary pozanda näsazlyk boldy:", error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            } else {
                setAlertMessage(`Topary pozmakda näsazlyk boldy: ${error.response?.data?.detail || 'Näbelli ýalňyşlyk'}. Serwer tarapyndaky API-niň dogry işleýändigini barlaň.`);
            }
        }
    };

    const showGroupStudents = (groupName) => {
        setSelectedGroup(groupName);
        setView('groupStudentsList');
    };

    const showStudentTests = (student) => {
        setSelectedStudent(student);
        setView('studentResults');
    };

    const showStudentTestReview = (test) => {
        setStudentReviewTest(test);
        setView('studentTestReview');
    };

    // UI Render funksiýalary
    const renderStudentTestReview = () => (
        <div className="quiz-card review-card">
            <button className="back-btn" onClick={() => setView('studentResults')}>← Yza</button>
            <h2 className="main-title">Testiň jikme-jigi: **{studentReviewTest?.tema}**</h2>
            <div className="review-questions">
                {studentReviewTest?.reviewQuestions.length > 0 ? (
                    studentReviewTest.reviewQuestions.map((q, i) => (
                        // Sorag kartasy, dogry/ýalňyş boýunça reňk
                        <div key={`${q.question_text}-${i}`} className={`review-item ${q.isCorrect ? "review-correct" : "review-incorrect"}`}>
                            <p className="review-q-tema">Sowal {i + 1}: **{q.question_text}**</p>
                            <div className="review-answers-container">
                                {(q.answers || []).map((ans, j) => {
                                    const ansText = String(ans).trim();
                                    const isUserAnswer = ansText === q.userAnswer;
                                    const isCorrectAnswer = ansText === q.correctAnswer;

                                    return (
                                        <div
                                            key={`${i}-${j}`}
                                            className={`review-answer-btn 
                                                    ${isCorrectAnswer ? 'correct' : ''} 
                                                    ${isUserAnswer && !isCorrectAnswer ? 'incorrect' : ''}`
                                            }
                                        >
                                            {ans}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="review-info">
                                <strong>Okuwçynyň jogaby:</strong> <span className={q.isCorrect ? 'correct-text' : 'incorrect-text'}>{q.userAnswer || "Jogap berilmedi"}</span><br />
                                <strong>Dogry jogap:</strong> <span className="correct-text">{q.correctAnswer}</span>
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="no-tests-message">Bu test üçin jikme-jik sowal-jogap maglumaty serwerden gelmedi.</p>
                )}
            </div>
        </div>
    );

    const renderGroupList = () => (
        <>
            <button className="back-btn" onClick={() => setView('mugallymHome')}>← Yza</button>
            <h2 className="main-title">Toparlara Görä Test Netijeleri</h2>
            {Object.keys(studentsByGroup).length > 0 ? (
                <div className="card-grid">
                    {Object.keys(studentsByGroup).map(groupName => (
                        <div key={groupName} className="test-card group-card">
                            <div className="column-left">
                                <div className="tema-wrap">Topar: {groupName}</div>
                                <div className="count">Okuwçy Sany: {studentsByGroup[groupName].length}</div> {/* Topardaky okuwçy sany */}
                            </div>
                            <div className="column-right">
                                <button className="btn btn-blue" onClick={() => showGroupStudents(groupName)}>Gör</button>
                                {/* <button className="delete-btn" onClick={() => deleteGroup(groupName)}>❌</button> */}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-tests-message">Heniz topar tapylmady.</p>
            )}
        </>
    );

    const renderGroupStudentsList = () => {
        const groupStudents = studentsByGroup[selectedGroup] || [];
        return (
            <>
                <button className="back-btn" onClick={() => setView('groupList')}>← Yza</button>
                <h2 className="main-title">Topar: **{selectedGroup}** - Okuwçylar</h2>

                {groupStudents.length > 0 ? (
                    <div className="card-grid">
                        {groupStudents.map(student => (
                            <div key={student.id} className="test-card student-card">

                                <div className="column-left">
                                    <div className="tema-wrap">Ady: {student.name} <br />Familiýasy: {student.surname} </div> {/* Talyp ady/familiýasy */}
                                    <div className="count">Tamamlanan test: {student.completedTests.length}</div>
                                </div>
                                <div className="column-right">
                                    <button className="btn btn-blue" onClick={() => showStudentTests(student)}>Netijeleri Gör</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-tests-message">Bu toparda heniz test tamamlanmady.</p>
                )}
            </>
        );
    };

    const renderStudentResults = () => (
        <>
            <button className="back-btn" onClick={() => setView('groupStudentsList')}>← Yza</button>
            <h2 className="main-title">**{selectedStudent?.name} {selectedStudent?.surname} ** - Test Taryhy</h2>
            {selectedStudent?.completedTests.length > 0 ? (
                <div className="card-grid">
                    {selectedStudent.completedTests.map((t, i) => (
                        <div key={t.id || i} className="test-card card-two-column-layout">
                            <div className="column-left">
                                <div className="tema-wrap">Tema: **{t.tema}**</div>
                                <div className="mugallym-info">
                                </div>
                                <div className="count">Baly: **{t.score}** / **{t.totalQuestions}** ({(t.totalQuestions > 0 ? Math.round((t.score / t.totalQuestions) * 100) : 0)}%)</div>
                            </div>
                            <div className="column-right">
                                {/* Jikme-jiklik üçin diňe reviewQuestions bar bolsa Gör düwmesini görkez */}
                                {t.reviewQuestions && t.reviewQuestions.length > 0 ? (
                                    <button className="btn btn-blue" onClick={() => showStudentTestReview(t)}>Jikma-jik</button>
                                ) : (
                                    <span className="info-text info-gray">Jikme-jiklik ýok</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-tests-message">**{selectedStudent?.name}** heniz test tamamlanmady.</p>
            )}
        </>
    );

    // UI Kömekçi komponent
    const CustomAlert = ({ message, onClose }) => {
        if (!message) return null;
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <p className="modal-text">{message}</p>
                    <button onClick={onClose} className="btn btn-green">Hawa</button>
                </div>
            </div>
        );
    };

    const renderLastFivePreview = () => {
        const start = Math.max(0, questions.length - 5);
        const lastFive = questions.slice(start);
        return (
            <div className="last-five-preview">
                <h4 className="preview-title">Soňky {lastFive.length} Sowal (Yazan temanyzyn ady!)</h4>
                <ul>
                    {lastFive.map((q, idx) => (
                        <li key={start + idx}>{start + idx + 1}. {q.question_text || '---'}</li>
                    ))}
                </ul>
            </div>
        );
    };

    // Test redaktirleme (Analysis) render funksiýasy
    const renderAnalysis = () => (
        <div className="quiz-card review-card">
            <button className="back-btn" onClick={() => setView('mugallymHome')}>← Yza</button>
            <h2 className="main-title">Testi Düzediş: **{analyzedTest?.theme}**</h2>

            {/* Sorag sanawyny süzmek üçin stil */}
            <div className="review-questions " style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                {analyzedTest?.questions.length > 0 ? (
                    analyzedTest.questions.map((q, i) => (
                        <div key={i} className="review-item edit-item">
                            <h4 className="edit-q-title">Sowal {i + 1}</h4>

                            {/* SORAG TEKSTI MEÝDANÇASY */}
                            <textarea
                                rows="3"
                                placeholder="Soragyň teksti"
                                value={q.question_text || ''}
                                onChange={e => handleEditQuestionText(e, i)}
                                className="input-field "
                                style={{ minHeight: '120px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                            />

                            {/* JOGAP OPSIÝALARY */}
                            <div className="answers-container mt-3">
                                {q.answers.map((ans, j) => (
                                    <input
                                        key={j}
                                        type="text"
                                        // ❗️ Jogap bahasyny (tekstini) görkezmek
                                        value={ans}
                                        // ❗️ Jogaby üýtgetmäge mümkinçilik bermek
                                        onChange={e => handleEditAnswerText(e.target.value, i, j)}
                                        placeholder={`Jogap ${j + 1}`}
                                        className="input-field mb-2"
                                        // Dogry jogaby tapawutlandyrmak (e.g., 1-nji jogap)
                                        style={j === 0 ? { border: '2px solid #16a34a' } : {}}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="no-tests-message">Bu testde sorag ýok.</p>
                )}
            </div>
            {/* ❗️ Täze Düzedilen Save düwmesi */}
            <button onClick={handleSaveEdit} className="btn btn-green save-edit-btn">Düzedişleri Sakla</button>
        </div>
    );

    // Mugallym adyny çagyrmak
    const mugallymSurname = localStorage.getItem('mugallymSurname');

    // --- Esasy Return (Doly Komponent Gurluşy) ---
    return (
        <div className="app-bg">
            <header className="app-header">
                {view === 'mugallymHome' && (
                    <button onClick={handleLogout} className="logout-btn">
                        Çykyş
                    </button>
                )}
            </header>

            <main className="main-container">
                <CustomAlert message={alertMessage} onClose={() => setAlertMessage('')} />

                {/* Mugallym Baş Sahypasy */}
                {view === 'mugallymHome' && (
                    <>
                        <div className="button-bottom">
                            <button className="btn btn-green">Testler</button>
                            <button className="btn btn-gray" onClick={showHistory}>Taryh</button>
                        </div>
                        {savedTests.length > 0 ? (
                            <div className="card-grid">
                                {[...savedTests].reverse().map((t) => (
                                    <div key={t.id} className="test-card card-two-column-layout">
                                        <div className="column-left">
                                            <div className="tema-wrap">Tema: **{t.theme}**</div>
                                            <div className="mugallym-info">
                                                <span>Mugallym: {t.teacher?.surname || 'Ýok'}</span>
                                                <span className="date-info">{new Date(t.create_at).toLocaleString("tk-TM")}</span>
                                            </div>
                                            <div className="count">Sowal sany: {t.number_question}</div>
                                        </div>
                                        <div className="column-right">
                                            <button className="ugrat-btn" onClick={() => handleUgratClick(t)}>Ugrat</button>
                                            <button className="ugrat-btn" onClick={() => handleAnalysisClick(t)}>Testi Gör/Düzediş</button>
                                            <button className="delete-btn" onClick={() => deleteTest(t.id)}>🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-tests-message">Heniz test taýynlanmady.</p>
                        )}
                        <button onClick={startInputStage} className="home-add-btn">+</button>
                    </>
                )}

                {/* Tema/Sowal sany girizmek sahypasy */}
                {view === 'inputStage' && (
                    <div className="card">
                        <button onClick={() => setView('mugallymHome')} className="back-btn-inner">← Yza</button>
                        <input type="text" placeholder="Tema" value={theme} onChange={e => setTema(e.target.value)} className="input-field" />
                        <input type="number" min="0" placeholder="Sowal sany" value={number_question} onChange={e => setPeople(Number(e.target.value))} className="input-field" />
                        <button onClick={startTest} className="btn btn-green">Dowam et</button>
                    </div>
                )}


                {/* Sorag döretmek sahypasy (Step 2) */}
                {view === 'step2' && (
                    // ❗️ Täze stil: card elementini süzülmäge (scroll) mümkinçilik bermek
                    <div className="card" style={{ maxHeight: '80vh', overflowY: 'auto', padding: '20px' }}>
                        <button onClick={goBack} className="back-btn-inner">← Yza</button>
                        <h3 className="text-xl font-bold">Sowal {currentIndex + 1} / {number_question}</h3>

                        {/* Soragyň teksti üçin `textarea` ulanmak has dogry, öňki teklipde edilişi ýaly */}
                        <textarea
                            rows="3" // Iň azy 3 setir
                            placeholder={`Sowal ${currentIndex + 1} tekstini giriz`}
                            value={questions[currentIndex].question_text}
                            onChange={handleQuestionChange}
                            className="input-field mb-1 large-input textarea-15px-height"
                        // Textarea-nyň özüniň beýikligini üýtgetmegine ýol berýär (CSS: resize: vertical)
                        />

                        {/* Jogap opsiýalary */}
                        {questions[currentIndex].answers.map((answer, idx) => (
                            <input
                                key={idx}
                                type="text"
                                placeholder={idx === 0 ? 'Dogry Jogap ' : `Ýalňyş Jogap ${idx}`}
                                value={answer}
                                onChange={e => handleAnswerChange(idx, e.target.value)}
                                className="input-field mb-2"
                                style={idx === 0 ? { border: '2px solid #16a34a' } : {}}
                            />
                        ))}

                        {renderLastFivePreview()}

                        <button onClick={saveCurrent} className="btn btn-green mt-4">
                            {(currentIndex + 1 < number_question) ? 'Indiki Sowal' : 'Testi Sakla'}
                        </button>
                    </div>
                )}


                {/* Test Ugratmak Sazlamasy sahypasy */}
                {view === 'timerSetup' && selectedTest && (
                    <div className="card">
                        <button onClick={() => setView('mugallymHome')} className="back-btn-inner">← Yza</button>
                        <h2 className="main-title">Testi Ugratmak: **{selectedTest.theme}**</h2>

                        <label className="input-label">Wagt (Minut):</label>
                        <input
                            type="number"
                            min="1"
                            placeholder="Wagt (Minut)"
                            value={wagt}
                            onChange={e => setWagt(Number(e.target.value))}
                            className="input-field"
                        />

                        <label className="input-label">Topar (Nomero/Ady):</label>
                        <input
                            type="text"
                            placeholder="Toparyň Ady/Nomeri"
                            value={group}
                            onChange={e => setGroup(e.target.value)}
                            className="input-field"
                        />

                        <label className="input-label">Ugradylmaly Sowal Sany (Maks. {selectedTest.number_question}):</label>
                        <input
                            type="number"
                            min="1"
                            max={selectedTest.number_question}
                            placeholder="Sowal sany"
                            value={peopleCount}
                            onChange={e => setPeopleCount(Math.min(selectedTest.number_question, Number(e.target.value)))}
                            className="input-field"
                        />

                        <button onClick={startMugallymQuiz} className="btn btn-green mt-4">Ugrat</button>
                    </div>
                )}

                {/* Taryh: Topar Sanawy */}
                {view === 'groupList' && renderGroupList()}

                {/* Taryh: Okuwçy Sanawy */}
                {view === 'groupStudentsList' && renderGroupStudentsList()}

                {/* Taryh: Okuwçynyň Netijeleri */}
                {view === 'studentResults' && renderStudentResults()}

                {/* Taryh: Jikme-jik Test Barlagy (Review) */}
                {view === 'studentTestReview' && renderStudentTestReview()}

                {/* Test Redaktirleme (Analysis) */}
                {view === 'analysis' && renderAnalysis()}

                {/* Internet baglanyşyk duýduryşy */}
                {!isOnline && (
                    <div className="offline-warning">
                        ⚠️ Internetiňiz ýok!
                    </div>
                )}
            </main>
        </div>
    );
}
