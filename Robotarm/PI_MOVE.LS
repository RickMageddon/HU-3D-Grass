/PROG  PI_MOVE
/ATTR
COMMENT		= "J to R[111..116] at R[110]%";
DEFAULT_GROUP	= 1,*,*,*,*;
/MN
   1:  !Pi writes J1..J6 in R[111..116], speed % in R[110] ;
   2:  PR[1]=JPOS    ;
   3:  PR[1,1]=R[111]    ;
   4:  PR[1,2]=R[112]    ;
   5:  PR[1,3]=R[113]    ;
   6:  PR[1,4]=R[114]    ;
   7:  PR[1,5]=R[115]    ;
   8:  PR[1,6]=R[116]    ;
   9:J PR[1] R[110]% FINE    ;
/END
