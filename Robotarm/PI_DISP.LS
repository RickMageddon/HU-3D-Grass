/PROG  PI_DISP
/ATTR
COMMENT		= "Pi dispatcher R[100]";
DEFAULT_GROUP	= 1,*,*,*,*;
/MN
   1:  !Pi writes a program number in R[100] ;
   2:  !R[101] = number running, 0 = idle ;
   3:  R[100]=0    ;
   4:  R[101]=0    ;
   5:  LBL[1] ;
   6:  WAIT R[100]<>0    ;
   7:  R[101]=R[100]    ;
   8:  IF R[101]=1,CALL PI_PING ;
   9:  IF R[101]=2,CALL TEST ;
  10:  IF R[101]=3,CALL CLAUDE_J6 ;
  11:  IF R[101]=9,CALL PI_MOVE ;
  12:  R[101]=0    ;
  13:  R[100]=0    ;
  14:  JMP LBL[1] ;
/END
