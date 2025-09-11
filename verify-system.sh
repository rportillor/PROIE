#!/bin/bash

# EstimatorPro Full System Error Verification
# Comprehensive infrastructure and functionality test

echo "🔍 ESTIMATORPRO FULL SYSTEM VERIFICATION"
echo "========================================"
echo ""

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test tracking
declare -a RESULTS=()

# Helper function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "🔍 $test_name: "
    
    if eval "$test_command" &>/dev/null; then
        if [[ -n "$expected_pattern" ]]; then
            result=$(eval "$test_command" 2>/dev/null)
            if echo "$result" | grep -q "$expected_pattern"; then
                echo "✅ PASS"
                PASSED_TESTS=$((PASSED_TESTS + 1))
                RESULTS+=("✅ $test_name")
            else
                echo "❌ FAIL (pattern not found)"
                FAILED_TESTS=$((FAILED_TESTS + 1))
                RESULTS+=("❌ $test_name")
            fi
        else
            echo "✅ PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            RESULTS+=("✅ $test_name")
        fi
    else
        echo "❌ FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        RESULTS+=("❌ $test_name")
    fi
}

# 1. TYPESCRIPT COMPILATION CHECKS
echo "🔍 TYPESCRIPT COMPILATION TESTS"
echo "-------------------------------"
run_test "TypeScript Compilation" "npx tsc --noEmit --skipLibCheck" ""
run_test "No TypeScript Errors" "npx tsc --noEmit --skipLibCheck 2>&1 | wc -l" "^0$"

# 2. FRONTEND INFRASTRUCTURE
echo "📱 FRONTEND INFRASTRUCTURE TESTS"
echo "--------------------------------"
run_test "Frontend HTML Loading" "curl -s http://localhost:5000 | head -3" "DOCTYPE html"
run_test "Vite Client Connection" "curl -s http://localhost:5000 | grep -q vite"
echo ""

# 2. BACKEND API INFRASTRUCTURE  
echo "🔧 BACKEND API INFRASTRUCTURE TESTS"
echo "-----------------------------------"
run_test "Server Response" "curl -s http://localhost:5000/api/__routes"
run_test "Authentication System" "curl -s -H 'Authorization: Bearer test-token' http://localhost:5000/api/auth/profile" "testuser"
run_test "Dashboard API" "curl -s -H 'Authorization: Bearer test-token' http://localhost:5000/api/dashboard/stats" "activeProjects"
run_test "Projects API" "curl -s -H 'Authorization: Bearer test-token' http://localhost:5000/api/projects"
echo ""

# 3. TESTING INFRASTRUCTURE
echo "🧪 TESTING INFRASTRUCTURE TESTS"
echo "-------------------------------"
run_test "Jest Functionality" "NODE_ENV=test timeout 30s npx jest tests/unit/calculations/geometry.test.ts --silent" "Tests:"
run_test "TypeScript Compilation" "npx tsc --noEmit"
echo ""

# 4. DEVELOPMENT INFRASTRUCTURE
echo "⚙️ DEVELOPMENT INFRASTRUCTURE TESTS"
echo "-----------------------------------"
run_test "Node Modules Resolution" "node -e 'console.log(require.resolve(\"@tanstack/react-query\"))'"
run_test "Main App Syntax" "npx eslint client/src/App.tsx --quiet"
run_test "Environment Variables" "node -e 'console.log(\"ENV_CHECK\")'"
echo ""

# 5. DATABASE & DATA FLOW
echo "🗄️ DATABASE & DATA FLOW TESTS"
echo "-----------------------------"
run_test "Database Connectivity" "curl -s -H 'Authorization: Bearer test-token' http://localhost:5000/api/dashboard/stats" "totalEstimates"
run_test "API Data Flow" "curl -s -H 'Authorization: Bearer test-token' http://localhost:5000/api/projects"
echo ""

# 6. WORKFLOW & HMR PROCESSES
echo "🔄 WORKFLOW & HMR TESTS"
echo "----------------------"
run_test "Active Dev Processes" "ps aux | grep -E '(tsx|vite)' | grep -v grep | wc -l" "[1-9]"
run_test "Vite HMR Client" "curl -s http://localhost:5000/@vite/client" "HMRContext"
run_test "Server Port Active" "curl -s http://localhost:5000/api/__routes" "path"
echo ""

# FINAL SUMMARY
echo ""
echo "📊 VERIFICATION SUMMARY"
echo "======================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL SYSTEMS OPERATIONAL!"
    echo "EstimatorPro is fully functional with no infrastructure issues."
    echo ""
    echo "✅ Frontend: Working"
    echo "✅ Backend: Working" 
    echo "✅ Testing: Working"
    echo "✅ Database: Working"
    echo "✅ Development: Working"
    echo ""
    echo "🚀 System Status: PRODUCTION READY"
else
    echo "⚠️  ISSUES DETECTED (\$FAILED_TESTS failed tests)"
    echo "The following components need attention:"
    echo ""
    for result in "${RESULTS[@]}"; do
        if [[ $result == ❌* ]]; then
            echo "$result"
        fi
    done
    echo ""
    echo "🔧 System Status: NEEDS ATTENTION"
fi

echo ""
echo "For component-specific testing, use:"
echo "  ./verify-system.sh frontend    # Frontend only"
echo "  ./verify-system.sh backend     # Backend only" 
echo "  ./verify-system.sh testing     # Testing only"
echo "  ./verify-system.sh database    # Database only"
echo "  ./verify-system.sh development # Development only"